<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
require_once __DIR__ . '/../config.php';
try {
    $sql = "SELECT g.name AS group_name, g.description, c.code, c.name AS company_name, c.sector, c.market_cap AS mcap, c.pbv, c.klasifikasi AS klas
            FROM groups_tbl g JOIN company_groups cg ON cg.group_id=g.id JOIN companies c ON c.id=cg.company_id
            ORDER BY g.name, c.code";
    $rows = $pdo->query($sql)->fetchAll();
    // group by group_name
    $groups = [];
    foreach ($rows as $r) {
        $gn = $r['group_name'];
        if (!isset($groups[$gn])) $groups[$gn] = ['name'=>$gn,'description'=>$r['description'],'companies'=>[]];
        $groups[$gn]['companies'][] = $r;
    }
    echo json_encode(array_values($groups));
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error'=>$e->getMessage()]);
}
