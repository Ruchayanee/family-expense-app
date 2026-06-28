import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs/family-expense-app");
const outputPath = path.join(outputDir, "family-expense-database-template.xlsx");

const workbook = Workbook.create();

const sheets = {
  expenses: workbook.worksheets.add("Expenses"),
  categories: workbook.worksheets.add("Categories"),
  users: workbook.worksheets.add("Users"),
  paymentMethods: workbook.worksheets.add("PaymentMethods"),
  settings: workbook.worksheets.add("Settings")
};

const headerFill = "#0B1F3A";
const headerFont = "#FFFFFF";
const sectionFill = "#EAF0F7";
const border = "#D8DEE9";

function styleHeader(sheet, range) {
  const header = sheet.getRange(range);
  header.format.fill.color = headerFill;
  header.format.font.color = headerFont;
  header.format.font.bold = true;
  header.format.borders = { preset: "all", style: "thin", color: border };
  header.format.wrapText = true;
}

function styleBody(sheet, range) {
  const body = sheet.getRange(range);
  body.format.borders = { preset: "all", style: "thin", color: border };
  body.format.wrapText = true;
}

function setWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width;
  });
}

function setupSheet(sheet, title, note, headerRange, bodyRange, widths) {
  sheet.showGridLines = false;
  sheet.getRange("A1:H1").merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format.font.bold = true;
  sheet.getRange("A1").format.font.size = 16;
  sheet.getRange("A1").format.fill.color = sectionFill;
  sheet.getRange("A1").format.borders = { preset: "outside", style: "thin", color: border };
  sheet.getRange("A2:H2").merge();
  sheet.getRange("A2").values = [[note]];
  sheet.getRange("A2").format.font.color = "#44546A";
  sheet.getRange("A2").format.wrapText = true;
  styleHeader(sheet, headerRange);
  styleBody(sheet, bodyRange);
  sheet.freezePanes.freezeRows(3);
  setWidths(sheet, widths);
}

sheets.expenses.getRange("A3:K3").values = [[
  "id",
  "date",
  "title",
  "category",
  "amount",
  "payer",
  "paymentMethod",
  "note",
  "receiptUrl",
  "createdBy",
  "createdAt"
]];
sheets.expenses.getRange("A4:K4").values = [[
  "exp_demo_001",
  new Date("2026-06-28"),
  "อาหารเย็น",
  "ค่าอาหาร",
  120,
  "โอม",
  "เงินสด",
  "ตัวอย่างข้อมูล ลบได้หลังเริ่มใช้จริง",
  "",
  "โอม",
  new Date("2026-06-28T10:00:00")
]];
setupSheet(
  sheets.expenses,
  "Expenses",
  "ฐานข้อมูลรายจ่ายหลัก: เพิ่ม แก้ไข ลบผ่าน Web App เท่านั้น",
  "A3:K3",
  "A4:K200",
  [18, 14, 24, 18, 14, 14, 18, 32, 28, 16, 22]
);
sheets.expenses.getRange("B4:B200").setNumberFormat("yyyy-mm-dd");
sheets.expenses.getRange("E4:E200").setNumberFormat("#,##0.00");
sheets.expenses.getRange("K4:K200").setNumberFormat("yyyy-mm-dd hh:mm");

sheets.categories.getRange("A3:C3").values = [["category", "active", "sortOrder"]];
sheets.categories.getRange("A4:C16").values = [
  ["ค่าอาหาร", true, 1],
  ["ค่าน้ำมัน", true, 2],
  ["ค่าเดินทาง", true, 3],
  ["ค่าไฟ", true, 4],
  ["ค่าน้ำ", true, 5],
  ["ค่าอินเทอร์เน็ต", true, 6],
  ["ค่าบ้าน", true, 7],
  ["ค่าของใช้", true, 8],
  ["ค่ารักษาพยาบาล", true, 9],
  ["ค่าซ่อมรถ", true, 10],
  ["ค่าซ่อมบ้าน", true, 11],
  ["ช้อปปิ้ง", true, 12],
  ["อื่น ๆ", true, 13]
];
setupSheet(
  sheets.categories,
  "Categories",
  "เพิ่มหมวดใหม่ได้โดยเพิ่มแถวและตั้ง active เป็น TRUE",
  "A3:C3",
  "A4:C100",
  [24, 12, 12]
);

sheets.users.getRange("A3:F3").values = [["userId", "name", "role", "pinHash", "active", "note"]];
sheets.users.getRange("A4:F6").values = [
  ["u_admin", "โอม", "Admin", "เปลี่ยนเป็น hash ก่อนใช้จริง", true, "เพิ่ม/แก้ไข/ลบ/Export ได้"],
  ["u_pa", "ป๊า", "Viewer", "เปลี่ยนเป็น hash ก่อนใช้จริง", true, "ดูข้อมูลเท่านั้น"],
  ["u_ma", "ม๊า", "Viewer", "เปลี่ยนเป็น hash ก่อนใช้จริง", true, "ดูข้อมูลเท่านั้น"]
];
setupSheet(
  sheets.users,
  "Users",
  "เก็บผู้ใช้และสิทธิ์ ห้ามเก็บ PIN จริงในระบบใช้งานจริง",
  "A3:F3",
  "A4:F50",
  [16, 16, 14, 34, 12, 32]
);

sheets.paymentMethods.getRange("A3:C3").values = [["paymentMethod", "active", "sortOrder"]];
sheets.paymentMethods.getRange("A4:C8").values = [
  ["เงินสด", true, 1],
  ["โอน", true, 2],
  ["QR", true, 3],
  ["บัตรเครดิต", true, 4],
  ["บัตรเดบิต", true, 5]
];
setupSheet(
  sheets.paymentMethods,
  "PaymentMethods",
  "เพิ่มวิธีชำระเงินได้โดยเพิ่มแถวและตั้ง active เป็น TRUE",
  "A3:C3",
  "A4:C50",
  [22, 12, 12]
);

sheets.settings.getRange("A3:D3").values = [["key", "value", "description", "updatedAt"]];
sheets.settings.getRange("A4:D8").values = [
  ["currency", "THB", "สกุลเงินหลัก", new Date("2026-06-28")],
  ["timezone", "Asia/Bangkok", "เขตเวลาที่ใช้คำนวณรายวัน", new Date("2026-06-28")],
  ["appName", "รายจ่ายครอบครัว", "ชื่อแอปที่แสดงในหน้าเว็บ", new Date("2026-06-28")],
  ["adminUserId", "u_admin", "ผู้ใช้ Admin หลัก", new Date("2026-06-28")],
  ["receiptMode", "url", "เก็บลิงก์สลิปหรือใบเสร็จ", new Date("2026-06-28")]
];
setupSheet(
  sheets.settings,
  "Settings",
  "ค่ากลางของระบบ แก้ได้โดยไม่ต้องแก้โค้ดเมื่อ API อ่านจากชีตนี้",
  "A3:D3",
  "A4:D50",
  [22, 24, 42, 18]
);
sheets.settings.getRange("D4:D50").setNumberFormat("yyyy-mm-dd");

const checks = await workbook.inspect({
  kind: "sheet,table",
  maxChars: 6000,
  tableMaxRows: 8,
  tableMaxCols: 8
});
console.log(checks.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan"
});
console.log(errors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
