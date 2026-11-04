<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once __DIR__ . '/../config.php';

$code = isset($_GET['code']) ? strtoupper(trim($_GET['code'])) : '';
if (!$code) { http_response_code(400); echo json_encode(['error'=>'code required']); exit; }

try {
    // fetch company data
    $stmt = $pdo->prepare("SELECT * FROM companies WHERE code = ?");
    $stmt->execute([$code]);
    $c = $stmt->fetch();
    if (!$c) { http_response_code(404); echo json_encode(['error'=>'not found']); exit; }

    // fetch financials
    $fstmt = $pdo->prepare("SELECT * FROM financials WHERE company_id = ? ORDER BY period DESC LIMIT 1");
    $fstmt->execute([$c['id']]);
    $f = $fstmt->fetch();

    $price = (float)$c['harga'];
    $shares = (float)$c['jumlah_saham']; // miliar
    $mcap = (float)$c['market_cap']; // miliar
    $assets = (float)$c['total_aset']; // miliar
    $liab = (float)$c['total_liabilitas']; // miliar
    $equity = (float)$c['ekuitas']; // miliar
    $bvps = (float)$c['bvps'];
    $pbv = (float)$c['pbv'];
    $eps = (float)$c['eps'];
    $laba = (float)$c['laba_bersih']; // miliar
    $ni = $f ? (float)$f['net_income'] : $laba;
    $ta = $f ? (float)$f['total_assets'] : $assets;
    $tl = $f ? (float)$f['total_liabilities'] : $liab;
    $eq = $f ? (float)$f['equity'] : $equity;

    // derived
    $roe = ($eq > 0) ? ($ni / $eq) : null; // net income / equity
    $roa = ($ta > 0) ? ($ni / $ta) : null;
    $pe = ($eps > 0 && $price > 0) ? ($price / $eps) : null;
    $sharesAbs = $shares * 1e9; // absolute shares
    $bookValuePerShare = $bvps;
    $epsGrowth = 0.05; // assumed 5% growth
    $requiredReturn = 0.10; // 10% required return
    $riskFree = 0.065; // 6.5% risk-free (Indonesia)
    $gordonGrowth = 0.03; // 3% perpetual growth
    $payoutRatio = 0.30; // assumed 30% payout

    $methods = [];

    // 1. Graham Number
    if ($eps > 0 && $bvps > 0) {
        $methods['graham_number'] = [
            'name' => 'Graham Number',
            'formula' => 'sqrt(22.5 × EPS × BVPS)',
            'value' => round(sqrt(22.5 * $eps * $bvps), 2),
            'description' => 'Benjamin Graham formula: akar(22.5 × EPS × BVPS). Konservatif, cocok untuk value investing.'
        ];
    }

    // 2. PE-based Fair Value (15x)
    if ($eps > 0) {
        $methods['pe_15x'] = [
            'name' => 'PE-based (15x)',
            'formula' => 'EPS × 15',
            'value' => round($eps * 15, 2),
            'description' => 'Fair value berdasarkan PE ratio 15x (standar Graham).'
        ];
    }

    // 3. PE-based (sector median ~12x for IDX)
    if ($eps > 0) {
        $methods['pe_12x'] = [
            'name' => 'PE-based (12x)',
            'formula' => 'EPS × 12',
            'value' => round($eps * 12, 2),
            'description' => 'Fair value berdasarkan PE ratio 12x (rata-rata IDX).'
        ];
    }

    // 4. PBV-based (1.0x)
    if ($bvps > 0) {
        $methods['pbv_1x'] = [
            'name' => 'PBV-based (1.0x)',
            'formula' => 'BVPS × 1.0',
            'value' => round($bvps * 1.0, 2),
            'description' => 'Fair value berdasarkan PBV 1.0x (harga = book value).'
        ];
    }

    // 5. PBV-based (1.5x)
    if ($bvps > 0) {
        $methods['pbv_1_5x'] = [
            'name' => 'PBV-based (1.5x)',
            'formula' => 'BVPS × 1.5',
            'value' => round($bvps * 1.5, 2),
            'description' => 'Fair value berdasarkan PBV 1.5x.'
        ];
    }

    // 6. Asset-Based (NAV per share)
    if ($shares > 0 && $eq > 0) {
        $nav = ($eq * 1e9) / $sharesAbs;
        $methods['asset_based'] = [
            'name' => 'Asset-Based (NAV/share)',
            'formula' => 'Equity / Shares',
            'value' => round($nav, 2),
            'description' => 'Net Asset Value per share = Ekuitas / Jumlah Saham.'
        ];
    }

    // 7. Liquidation Value (simplified)
    if ($shares > 0 && $ta > 0) {
        $liq = (($ta - $tl) * 1e9) / $sharesAbs;
        $methods['liquidation'] = [
            'name' => 'Liquidation Value',
            'formula' => '(Total Aset - Total Liab) / Shares',
            'value' => round($liq, 2),
            'description' => 'Nilai likuidasi sederhana = (Aset - Liabilitas) / Saham.'
        ];
    }

    // 8. Earnings Power Value (EPV)
    if ($eps > 0) {
        $epv = $eps / $requiredReturn;
        $methods['epv'] = [
            'name' => 'Earnings Power Value (EPV)',
            'formula' => 'EPS / r (r=10%)',
            'value' => round($epv, 2),
            'description' => 'EPV = EPS / required return (10%). Asumsi laba stabil tanpa growth.'
        ];
    }

    // 9. Gordon Growth Model (DDM)
    if ($eps > 0 && $payoutRatio > 0) {
        $d1 = $eps * $payoutRatio * (1 + $gordonGrowth);
        $denom = $requiredReturn - $gordonGrowth;
        if ($denom > 0) {
            $ddm = $d1 / $denom;
            $methods['ddm'] = [
                'name' => 'Dividend Discount Model (Gordon)',
                'formula' => 'D1 / (r - g)',
                'value' => round($ddm, 2),
                'description' => 'DDM Gordon Growth. D1=EPS×payout×(1+g), r=10%, g=3%, payout=30%.'
            ];
        }
    }

    // 10. Residual Income Model
    if ($bvps > 0 && $roe !== null) {
        $ri = $bvps + (($roe - $requiredReturn) * $bvps) / ($requiredReturn - $gordonGrowth);
        $methods['residual_income'] = [
            'name' => 'Residual Income Model',
            'formula' => 'BVPS + (ROE - r)×BVPS / (r - g)',
            'value' => round($ri, 2),
            'description' => 'Residual Income = BVPS + (ROE - r) × BVPS / (r - g).'
        ];
    }

    // 11. Graham's Revised Formula
    if ($eps > 0) {
        $g = $epsGrowth * 100; // growth in %
        $grahamRev = $eps * (8.5 + 2 * $g);
        $methods['graham_revised'] = [
            'name' => "Graham's Revised Formula",
            'formula' => 'EPS × (8.5 + 2g)',
            'value' => round($grahamRev, 2),
            'description' => "Graham's revised: EPS × (8.5 + 2×growth%). Growth diasumsikan 5%."
        ];
    }

    // 12. PEG-based Fair Value
    if ($eps > 0 && $pe !== null && $pe > 0) {
        $growthPct = $epsGrowth * 100;
        $fairPE = $growthPct; // PEG = 1
        $pegFV = $eps * $fairPE;
        $methods['peg_based'] = [
            'name' => 'PEG-based Fair Value',
            'formula' => 'EPS × (Growth%)',
            'value' => round($pegFV, 2),
            'description' => 'Fair value dengan PEG=1: Fair PE = Growth Rate (%).'
        ];
    }

    // 13. DCF Simplified (perpetuity)
    if ($eps > 0) {
        $dcf = ($eps * (1 + $epsGrowth)) / ($requiredReturn - $gordonGrowth);
        $methods['dcf'] = [
            'name' => 'DCF (Simplified Perpetuity)',
            'formula' => 'EPS×(1+g) / (r - g)',
            'value' => round($dcf, 2),
            'description' => 'DCF sederhana: EPS×(1+g)/(r-g). g=5%, r=10%, g_perpetuity=3%.'
        ];
    }

    // 14. Earnings Yield
    if ($price > 0 && $eps > 0) {
        $ey = ($eps / $price) * 100;
        $methods['earnings_yield'] = [
            'name' => 'Earnings Yield',
            'formula' => '(EPS / Price) × 100',
            'value' => round($ey, 2),
            'description' => 'Earnings Yield = EPS/Price × 100%. Semakin tinggi semakin murah.'
        ];
    }

    // 15. Magic Formula (Greenblatt) - Earnings Yield + ROC
    if ($price > 0 && $eps > 0 && $eq > 0) {
        $ev = $mcap; // simplified: use market cap as EV
        $roc = ($eq > 0) ? ($ni / $eq) * 100 : 0;
        $ey2 = ($eps / $price) * 100;
        $magic = $ey2 + $roc;
        $methods['magic_formula'] = [
            'name' => "Magic Formula (Greenblatt)",
            'formula' => 'Earnings Yield + ROC',
            'value' => round($magic, 2),
            'description' => 'Magic Formula = Earnings Yield (%) + Return on Capital (%). Skor tinggi = bagus.'
        ];
    }

    // 16. NCAV (Net Current Asset Value) - simplified
    if ($shares > 0 && $ta > 0) {
        $ncav = (($ta * 0.8 - $tl) * 1e9) / $sharesAbs; // conservative: 80% of assets
        $methods['ncav'] = [
            'name' => 'NCAV (Conservative)',
            'formula' => '(0.8×Aset - Liab) / Shares',
            'value' => round($ncav, 2),
            'description' => 'NCAV konservatif = (80% × Aset - Liabilitas) / Saham. Margin of safety.'
        ];
    }

    // Calculate consensus (average of all price-based methods)
    $priceMethods = [];
    foreach ($methods as $k => $m) {
        if (in_array($k, ['earnings_yield', 'magic_formula'])) continue;
        if (isset($m['value']) && $m['value'] > 0) $priceMethods[] = $m['value'];
    }
    $avgFV = count($priceMethods) > 0 ? array_sum($priceMethods) / count($priceMethods) : null;
    $medianFV = null;
    if (count($priceMethods) > 0) {
        sort($priceMethods);
        $mid = (int)floor(count($priceMethods) / 2);
        $medianFV = (count($priceMethods) % 2 == 0) ? (($priceMethods[$mid-1] + $priceMethods[$mid]) / 2) : $priceMethods[$mid];
    }

    // upside calculations
    foreach ($methods as $k => &$m) {
        if (in_array($k, ['earnings_yield', 'magic_formula'])) continue;
        if (isset($m['value']) && $m['value'] > 0 && $price > 0) {
            $m['upside_pct'] = round(($m['value'] - $price) / $price * 100, 2);
        }
    }
    unset($m);

    echo json_encode([
        'code' => $code,
        'name' => $c['name'],
        'price' => $price,
        'eps' => $eps,
        'bvps' => $bvps,
        'pe' => $pe ? round($pe, 2) : null,
        'roe' => $roe ? round($roe * 100, 2) : null,
        'pbv' => $pbv,
        'mcap' => $mcap,
        'methods' => $methods,
        'summary' => [
            'avg_fair_value' => $avgFV ? round($avgFV, 2) : null,
            'median_fair_value' => $medianFV ? round($medianFV, 2) : null,
            'num_methods' => count($priceMethods),
            'avg_upside_pct' => ($avgFV && $price > 0) ? round(($avgFV - $price) / $price * 100, 2) : null,
            'median_upside_pct' => ($medianFV && $price > 0) ? round(($medianFV - $price) / $price * 100, 2) : null,
        ]
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
