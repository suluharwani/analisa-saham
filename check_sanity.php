<?php
require 'config.php';

// Check several companies
$codes = ['BBCA', 'TLKM', 'ASII', 'BREN', 'SMDR', 'ADRO', 'BYAN', 'GOTO', 'BMRI', 'BBRI'];
foreach ($codes as $code) {
    $stmt = $pdo->prepare("SELECT code, name, harga, jumlah_saham, market_cap, total_aset, total_liabilitas, ekuitas, bvps, pbv, eps, laba_bersih, graham_number, fair_value, upside, diskon, klasifikasi, soliditas FROM companies WHERE code = ?");
    $stmt->execute([$code]);
    $r = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "\n=== {$r['code']} - {$r['name']} ===\n";
    echo "  Harga: Rp " . number_format($r['harga'], 0) . "\n";
    echo "  Saham: " . $r['jumlah_saham'] . " miliar\n";
    echo "  Market Cap: Rp " . number_format($r['market_cap'], 0) . " miliar\n";
    echo "  Total Aset: Rp " . number_format($r['total_aset'], 2) . " miliar\n";
    echo "  Total Liab: Rp " . number_format($r['total_liabilitas'], 2) . " miliar\n";
    echo "  Ekuitas: Rp " . number_format($r['ekuitas'], 2) . " miliar\n";
    echo "  BVPS: Rp " . number_format($r['bvps'], 2) . "\n";
    echo "  PBV: " . number_format($r['pbv'], 2) . "x\n";
    echo "  EPS: Rp " . number_format($r['eps'], 2) . "\n";
    echo "  Laba: Rp " . number_format($r['laba_bersih'], 0) . " miliar\n";
    echo "  Graham: Rp " . number_format($r['graham_number'], 0) . "\n";
    echo "  Fair Value: Rp " . number_format($r['fair_value'], 0) . "\n";
    echo "  Upside: " . number_format($r['upside'], 1) . "%\n";
    echo "  Diskon: " . number_format($r['diskon'], 4) . "\n";
    echo "  Klasifikasi: {$r['klasifikasi']}, Soliditas: {$r['soliditas']}\n";
    
    // Sanity check: aset should be roughly comparable to market cap (within 10x)
    $ratio = $r['total_aset'] / $r['market_cap'];
    if ($ratio < 0.01 || $ratio > 100) {
        echo "  ⚠️ WARNING: Aset/MCap ratio = " . round($ratio, 4) . " (suspicious)\n";
    }
    // Sanity check: BVPS should be positive and reasonable
    if ($r['bvps'] > 0 && $r['harga'] > 0) {
        $bvpsRatio = $r['harga'] / $r['bvps'];
        if ($bvpsRatio > 100 || $bvpsRatio < 0.01) {
            echo "  ⚠️ WARNING: Harga/BVPS ratio = " . round($bvpsRatio, 2) . " (suspicious)\n";
        }
    }
}
