<?php
$code = 'BREN';
$ctx = stream_context_create(['http'=>['timeout'=>20,'user_agent'=>'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0']]);
$url = "https://stockanalysis.com/quote/idx/$code/financials/balance-sheet/";
$html = @file_get_contents($url, false, $ctx);
if (!$html) { echo "Failed\n"; exit; }

// Look for any script with financial data
preg_match_all('/<script[^>]*>(.*?)<\/script>/s', $html, $matches);
foreach ($matches[1] as $i => $script) {
    if (strlen($script) > 1000 && (strpos($script, 'asset') !== false || strpos($script, 'Asset') !== false)) {
        echo "Script $i has asset data (" . strlen($script) . " chars)\n";
        // Look for large numbers
        preg_match_all('/[\d,\.]{5,}/', $script, $nums);
        $unique = array_unique($nums[0]);
        echo "  Large numbers found: " . implode(', ', array_slice($unique, 0, 20)) . "\n";
        file_put_contents("D:/analisa saham/scratchpad/bs_script_$i.txt", $script);
    }
}
echo "\nTotal scripts: " . count($matches[1]) . "\n";
// Also check for any iframe or data-src
if (preg_match('/data-src="([^"]+)"/', $html, $m)) echo "data-src: " . $m[1] . "\n";
if (preg_match('/src="([^"]*balance[^"]*)"/', $html, $m)) echo "balance src: " . $m[1] . "\n";
