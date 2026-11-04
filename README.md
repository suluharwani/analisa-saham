# Analisa Valuasi Emiten BEI

Aplikasi web untuk analisa valuasi 913 emiten Bursa Efek Indonesia (BEI) dengan 16 metode penghitungan harga wajar saham.

## Fitur

- **Data Emiten**: 913 emiten BEI dengan data real dari stockanalysis.com (Okt 2026)
- **16 Metode Valuasi**: Graham Number, PE-Based, PBV-Based, Asset-Based (NAV), Liquidation Value, EPV, DDM (Gordon), Residual Income, Graham's Revised, PEG-Based, DCF, Earnings Yield, Magic Formula, NCAV
- **Perbandingan Metode**: Tabel perbandingan semua metode dengan popup analisa per metode
- **Grup Korporasi**: 16 grup konglomerasi (Sinar Mas, Astra, Salim, dll)
- **Pemegang Saham**: Data perusahaan induk/major shareholder
- **Jenis Saham**: Klasifikasi 16 jenis saham
- **Valuasi Agregat**: Proxy IHSG dengan aggregate PE/PBV
- **Filter & Sort**: Pencarian, filter sektor/grup/kategori/klasifikasi/soliditas
- **Export Excel**: 7 sheet (data, ringkasan, top diskon, top mahal, grup, jenis, chart)
- **Refresh Data**: Update data per emiten dari stockanalysis.com

## Tech Stack

- **Frontend**: HTML, CSS (Bootstrap-style), JavaScript (Vanilla)
- **Backend**: PHP 8.5 (built-in server)
- **Database**: MariaDB 13.0 (MySQL compatible)
- **Data Source**: stockanalysis.com, Google News RSS

## Setup

### Prerequisites
- PHP 8.x
- MariaDB/MySQL 8.x+
- Node.js (optional, for npm packages)

### Database Setup
1. Buat database `valuasi_bei`
2. Jalankan `scratchpad/create_db.sql` dan `scratchpad/create_groups.sql`
3. Import data dari `scratchpad/scrape_results.json` dan `scratchpad/directors.json`

### Run Server
```bash
# Windows
start_server.bat

# atau manual
php -S localhost:8000
```

Buka http://localhost:8000 di browser.

## Struktur Database

| Tabel | Rows | Deskripsi |
|-------|------|-----------|
| companies | 913 | Data emiten (harga, aset, laba, PBV, klasifikasi, dll) |
| directors | 4,966 | Direksi perusahaan |
| financials | 913 | Laporan keuangan (aset, liabilitas, ekuitas, laba) |
| shareholders | 197 | Pemegang saham (perusahaan induk) |
| groups_tbl | 16 | Grup konglomerasi |
| company_groups | 38 | Mapping emiten ke grup |

## Keputusan Investasi

Berdasarkan analisa 913 emiten:
- **STRONG BUY**: 57 (6.2%) — Layak Beli + Solid
- **BUY**: 160 (17.5%) — Layak Beli + Moderat
- **HOLD**: 115 (12.6%) — Netral
- **AVOID/SELL**: 581 (63.6%) — Tidak Layak / Rawan Gorengan

## Disclaimer

Semua informasi dalam website ini adalah untuk konsumsi pribadi dan edukasi. Bukan merupakan rekomendasi jual atau beli saham. Keputusan investasi sepenuhnya tanggung jawab pengguna.