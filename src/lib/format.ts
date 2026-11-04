export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount || 0)) + " đ";
}

export function formatShortVND(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} tr`;
  }
  if (abs >= 1_000) {
    return `${Math.round(amount / 1_000)}k`;
  }
  return `${amount}đ`;
}

export function formatDateVN(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const VIET_BANKS = [
  { bin: "970422", shortName: "MB Bank", fullName: "Ngân hàng TMCP Quân Đội (MB)" },
  { bin: "970436", shortName: "Vietcombank", fullName: "Ngân hàng TMCP Ngoại thương VN (VCB)" },
  { bin: "970407", shortName: "Techcombank", fullName: "Ngân hàng TMCP Kỹ thương VN (TCB)" },
  { bin: "970415", shortName: "VietinBank", fullName: "Ngân hàng TMCP Công thương VN (CTG)" },
  { bin: "970418", shortName: "BIDV", fullName: "Ngân hàng TMCP Đầu tư & Phát triển VN" },
  { bin: "970416", shortName: "ACB", fullName: "Ngân hàng TMCP Á Châu (ACB)" },
  { bin: "970423", shortName: "TPBank", fullName: "Ngân hàng TMCP Tiên Phong (TPB)" },
  { bin: "970432", shortName: "VPBank", fullName: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { bin: "970405", shortName: "Agribank", fullName: "Ngân hàng NN & PTNT Việt Nam" },
  { bin: "970403", shortName: "Sacombank", fullName: "Ngân hàng TMCP Sài Gòn Thương Tín" },
];

export function buildVietQRUrl(params: {
  bankBin: string;
  accountNo: string;
  accountName: string;
  amount: number;
  addInfo: string;
}): string {
  const { bankBin, accountNo, accountName, amount, addInfo } = params;
  if (!bankBin || !accountNo) return "";
  const cleanAcc = encodeURIComponent(accountNo.trim());
  const cleanName = encodeURIComponent(accountName.trim());
  const cleanInfo = encodeURIComponent(addInfo.trim());
  return `https://img.vietqr.io/image/${bankBin}-${cleanAcc}-compact2.png?amount=${Math.max(
    0,
    Math.round(amount)
  )}&addInfo=${cleanInfo}&accountName=${cleanName}`;
}

