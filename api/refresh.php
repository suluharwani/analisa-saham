<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once __DIR__ . '/../config.php';

$code = isset($_GET['code']) ? strtoupper(trim($_GET['code'])) : '';
if (!$code) { http_response_code(400); echo json_encode(['error'=>'code required']); exit; }

function fetchText($url) {
    $ctx = stream_context_create(['http'=>['timeout'=>20,'user_agent'=>'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0']]);
    $html = @file_get_contents($url, false, $ctx);
    if ($html === false) return null;
    return strip_tags($html);
}

function parseNum($s) {
    $s = trim($s);
    if ($s === '') return null;
    $mult = 1;
    if (substr($s, -1) === 'T') { $mult = 1e12; $s = substr($s, 0, -1); }
    elseif (substr($s, -1) === 'B') { $mult = 1e9; $s = substr($s, 0, -1); }
    elseif (substr($s, -1) === 'M') { $mult = 1e6; $s = substr($s, 0, -1); }
    $s = str_replace(',', '', $s);
    $v = floatval($s);
    return is_nan($v) ? null : $v * $mult;
}

try {
    $overview = fetchText("https://stockanalysis.com/quote/idx/$code/");
    $bs = fetchText("https://stockanalysis.com/quote/idx/$code/financials/balance-sheet/");
    if (!$overview || !$bs) { http_response_code(502); echo json_encode(['error'=>'fetch failed']); exit; }

    // price: number with decimals followed by change and percent
    $price = null;
    if (preg_match('/([\d,]+\.\d{1,2})\s+[+-]?[\d.,]+\s*\(\s*[+-]?[\d.]+%\s*\)/', $overview, $m)) {
        $price = floatval(str_replace(',', '', $m[1]));
    }
    // shares out
    $shares = null;
    if (preg_match('/Shares Out\s*([\d.,]+[BMT]?)/i', $overview, $m)) {
        $shares = parseNum($m[1]);
        if ($shares !== null) $shares = $shares / 1e9; // to billions
    }
    // sector
    $sector = null;
    if (preg_match('/Sector\s*\n\s*([A-Za-z &-]+)\n/i', $overview, $m)) {
        $sector = trim($m[1]);
    }
    // net income (ttm) in IDR (trillions -> number)
    $netIncome = null;
    if (preg_match('/Net Income\s+([\d.,]+[TBM]?)/i', $overview, $m)) {
        $netIncome = parseNum($m[1]);
    }
    // EPS
    $eps = null;
    if (preg_match('/EPS\s+([\d.,]+)/i', $overview, $m)) {
        $eps = floatval(str_replace(',', '', $m[1]));
    }
    // assets/liab: try to parse from raw HTML; fallback to existing DB values
    $assets = null; $liab = null; $currency = 'IDR';
    // existing values from DB
    $estmt = $pdo->prepare("SELECT total_aset, total_liabilitas, currency FROM companies WHERE code=?");
    $estmt->execute([$code]);
    $existing = $estmt->fetch();
    if ($existing) {
        $assets = $existing['total_aset'] !== null ? floatval($existing['total_aset']) / (($existing['currency']==='USD') ? (18060/1000) : (1/1000)) : null;
        // store in millions reported? We'll convert back below; simpler: keep existing miliar values
        $assets = $existing['total_aset'];
        $liab = $existing['total_liabilitas'];
        $currency = $existing['currency'] ?: 'IDR';
    }

    // name from overview (first heading)
    $name = null;
    if (preg_match('/PT .+? \(IDX:' . $code . '\)/', $overview, $m)) {
        $name = trim(str_replace(" (IDX:$code)", '', $m[0]));
    }

    // market cap
    $mcap = ($price !== null && $shares !== null) ? $price * $shares : null;

    // assets/liab already in miliar IDR (from DB); keep as-is
    $assetsM = $assets;
    $liabM = $liab;
    $equity = ($assetsM !== null && $liabM !== null) ? $assetsM - $liabM : null;
    $bvps = ($equity !== null && $shares) ? $equity / $shares : null;
    $pbv = ($bvps && $bvps != 0 && $price) ? $price / $bvps : null;
    $disc = ($pbv !== null) ? 1 - $pbv : null;
    $niM = $netIncome !== null ? $netIncome / 1e9 : null; // to miliar
    $graham = ($eps !== null && $bvps !== null && $eps > 0 && $bvps > 0) ? sqrt(22.5 * $eps * $bvps) : null;
    $fairValue = ($eps !== null && $eps > 0) ? $eps * 15 : null;
    $upside = ($fairValue !== null && $price) ? ($fairValue - $price) / $price * 100 : null;

    // kategori
    $kategori = '';
    if ($pbv !== null) {
        if ($pbv < 0) $kategori = 'Ekuitas negatif / N.M.';
        elseif ($pbv < 0.5) $kategori = 'Diskon ekstrem';
        elseif ($pbv < 0.8) $kategori = 'Diskon';
        elseif ($pbv < 1.5) $kategori = 'Wajar relatif aset';
        elseif ($pbv < 3) $kategori = 'Mahal relatif aset';
        else $kategori = 'Mahal ekstrem';
    }
    // soliditas
    $soliditas = 'Moderat';
    if ($equity !== null && $equity <= 0) $soliditas = 'Rawan Gorengan';
    elseif ($niM !== null && $niM <= 0) $soliditas = 'Rawan Gorengan';
    elseif ($pbv !== null && $pbv > 5) $soliditas = 'Rawan Gorengan';
    elseif ($mcap !== null && $mcap < 1000) $soliditas = 'Rawan Gorengan';
    elseif ($mcap !== null && $mcap >= 10000 && $pbv !== null && $pbv < 3) $soliditas = 'Solid';

    // klasifikasi
    $klas = 'Netral';
    if ($equity !== null && $equity <= 0) $klas = 'Tidak Layak';
    elseif ($niM !== null && $niM <= 0) $klas = 'Tidak Layak';
    elseif ($pbv !== null && $pbv >= 3) $klas = 'Tidak Layak';
    elseif ($graham !== null && $price !== null && $price > $graham * 1.25) $klas = 'Tidak Layak';
    elseif ($pbv !== null && $pbv < 0.8) $klas = 'Layak Beli';
    elseif ($graham !== null && $price !== null && $price <= $graham) $klas = 'Layak Beli';

    // update DB
    $stmt = $pdo->prepare("UPDATE companies SET name=COALESCE(?,name), sector=COALESCE(?,sector), tanggal_harga=?, harga=?, jumlah_saham=?, market_cap=?, total_aset=?, total_liabilitas=?, ekuitas=?, bvps=?, pbv=?, diskon=?, kategori=?, laba_bersih=?, eps=?, graham_number=?, fair_value=?, upside=?, currency=?, soliditas=?, klasifikasi=? WHERE code=?");
    $stmt->execute([
        $name, $sector, '26/10/2026', $price, $shares, $mcap, $assetsM, $liabM, $equity, $bvps, $pbv, $disc, $kategori, $niM, $eps, $graham, $fairValue, $upside, $currency, $soliditas, $klas, $code
    ]);

    // fetch updated row
    $stmt = $pdo->prepare("SELECT code,name,sector,tanggal_harga AS date,harga AS price,jumlah_saham AS shares,market_cap AS mcap,total_aset AS assets,total_liabilitas AS liab,ekuitas AS equity,bvps,pbv,diskon AS disc,kategori,laba_bersih AS laba,eps,graham_number AS graham,klasifikasi AS klas,fair_value AS fairValue,upside,currency,soliditas,catatan_khusus,riwayat_kasus,parent_company,group_name,jenis_saham FROM companies WHERE code=?");
    $stmt->execute([$code]);
    $row = $stmt->fetch();
    echo json_encode(['success'=>true,'data'=>$row]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error'=>$e->getMessage()]);
}
