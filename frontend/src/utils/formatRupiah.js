export function formatRupiah(angka) {
    const num = angka || 0;
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
}