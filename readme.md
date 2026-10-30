sebuah website yang saya ga tau namain perannya. saya kan udah ada 14+ aplikasi, perusahaan mau buat 1 tempat yang :

tempat berkumpulnya semua aplikasi dengan one click login (ini bukan seribet itu, bukan oauth, buka generate auth, token bereer segala macam cuma redirect username dan password doang kalau ga belum login ya login aja sendiri di website masing masing (ini input ide dari perusahaan)
nah ini input ide dari saya:

ini input dari saya:
- mau buat tempat updates pusat semacam update fitur yang nanti saya mau seperti todo.md dengan tanggal
- sebagai tempat dokumentasi how to use pusat juga, jadi semua aplikasi dokumentasinya mengarah kesini
- sebagai tempat x-api-key management untuk pihak luar (karena backend ku ada yang gunakan oleh perusahaan lain dan subsidiari)
- sebagai dokumentasi teknikal oleh yafizham (diriku sendiri) cara aturan aturan aplikasi yang kurang pantas untuk dokumentasi how to use karena terlalu teknikal. seperti cara gunain x-api-key, konsep voucher, konsep diskon, konsep sinkronisasi mobile POS, konsep socket warehouse queue management system

beberapa frontend sudah siap tersebar ditempat lain, jadi saya tarik kesini agar tidak dari 0. tidak perlu ikuti naman dan designnya

folder log_update_and_doc: refrensi tempat update fitur. jangan pakai frameworknya, pakai kode frontendnya saja untuk mempercepat kerjaan
@Config.jsx & @configApi.js: referensi untuk tempat konfigurasi awal, tentu masih banyak yang kurang
@DeveloperPage & @integration.js : refrensi untuk tempat x-api-key management


seperti yang kau liat untuk tiap api terdapat /open itu artinya mengarah ke backend workspace ini dengan nginx. tapi harusnya tidak butuh lagi karena sudah satu project
buat frontend dengan react vite saja