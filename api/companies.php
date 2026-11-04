<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once __DIR__ . '/../config.php';

try {
    $sql = "SELECT code, name, sector, tanggal_harga AS date, harga AS price, jumlah_saham AS shares,
            market_cap AS mcap, total_aset AS assets, total_liabilitas AS liab, ekuitas AS equity,
            bvps, pbv, diskon AS disc, kategori, laba_bersih AS laba, eps, graham_number AS graham,
            klasifikasi AS klas, fair_value AS fairValue, upside, currency,
            catatan_khusus, riwayat_kasus, parent_company, group_name, soliditas, jenis_saham
            FROM companies ORDER BY code";
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        foreach ($r as $k => $v) {
            if (is_numeric($v) && !in_array($k, ['code','name','sector','date','kategori','klas','currency','catatan_khusus','riwayat_kasus','parent_company','group_name','soliditas','jenis_saham'])) {
                $r[$k] = (float)$v;
            }
        }
    }
    echo json_encode($rows);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
