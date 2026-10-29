# 南青山三丁目 LP（C案・確定版）

- `index.html` … 本体ページ（ファーストビュー → 物件概要 → コンセプト → 建築プラン → … → お問い合わせCTA）
- `contact.html` … お問い合わせフォーム（デモ。送信は未接続）
- `css/c-final.css` … C案確定後の追加・修正スタイル。**今後の見た目の修正はこのファイルに追記**
- `js/site-3d.js` … 物件概要の3Dイメージ（夕景の街並み＋邸宅イメージ）
- `js/aerial-v5.js` … ロケーションの航空写真演出（01 俯瞰／02 駅徒歩7分）
- `js/slot.js` … 価格・面積のスロット表示
- `assets/geo/` … 国土地理院の航空写真（同梱）と OpenStreetMap の建物データ

ローカル確認：このフォルダで `python3 -m http.server 8890` を実行し、http://127.0.0.1:8890/ を開く。
出典表記（国土地理院・© OpenStreetMap contributors）は削除しないこと。
