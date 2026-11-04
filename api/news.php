<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
$url = 'https://news.google.com/rss/search?q=saham+BEI+Indonesia&hl=id&gl=ID&ceid=ID:id';
$ctx = stream_context_create(['http'=>['timeout'=>10,'user_agent'=>'Mozilla/5.0']]);
$xml = @file_get_contents($url, false, $ctx);
if (!$xml) { echo json_encode(['error'=>'gagal fetch','items'=>[]]); exit; }
$doc = @simplexml_load_string($xml);
$items = [];
if ($doc && isset($doc->channel->item)) {
    foreach ($doc->channel->item as $it) {
        $items[] = [
            'title' => (string)$it->title,
            'link' => (string)$it->link,
            'pubDate' => (string)$it->pubDate,
            'source' => (string)$it->source,
        ];
        if (count($items) >= 15) break;
    }
}
echo json_encode(['items'=>$items]);
