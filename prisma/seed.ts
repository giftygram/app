import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const pin = (p: string) => bcrypt.hashSync(p, 10);

async function main() {
  const existing = await db.employee.count();
  if (existing > 0) {
    console.log("Database already has employees — skipping seed.");
    return;
  }

  const [ops, mona, sara, khalid, ahmed] = await Promise.all([
    db.employee.create({ data: { name: "Layla", role: "OPERATIONS", pinHash: pin("1234") } }),
    db.employee.create({ data: { name: "Mona", role: "FLORIST", pinHash: pin("1111") } }),
    db.employee.create({ data: { name: "Sara", role: "FLORIST", pinHash: pin("2222") } }),
    db.employee.create({ data: { name: "Khalid", role: "DRIVER", pinHash: pin("3333") } }),
    db.employee.create({ data: { name: "Ahmed", role: "DRIVER", pinHash: pin("4444") } }),
  ]);

  const inHours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
  const inMinutes = (m: number) => new Date(Date.now() + m * 60 * 1000);

  const orders = [
    {
      orderNumber: "GG-1001",
      source: "WHATSAPP",
      status: "NEW",
      recipientName: "Fatima Al Marri",
      recipientPhone: "+971501234567",
      deliveryAddress: "Villa 12, Street 4, Jumeirah 1",
      deliveryArea: "Jumeirah",
      mapsLink: "https://maps.app.goo.gl/8fKjXQvxJt6Wn8QUA",
      occasion: "Birthday",
      cardMessage: "Happy birthday! Love, Ahmed",
      deadlineAt: inHours(3),
    },
    {
      orderNumber: "#SHOP-5821",
      source: "SHOPIFY",
      shopifyOrderId: "5821",
      status: "ASSIGNED_FLORIST",
      floristId: mona.id,
      recipientName: "Noora Hassan",
      recipientPhone: "+971502223344",
      deliveryAddress: "Apt 803, Marina Tower, Dubai Marina",
      deliveryArea: "Dubai Marina",
      occasion: "Anniversary",
      cardMessage: "10 wonderful years 💐",
      deadlineAt: inHours(1),
    },
    {
      orderNumber: "GG-1002",
      source: "WHATSAPP",
      status: "READY",
      floristId: sara.id,
      recipientName: "Omar Sultan",
      recipientPhone: "+971503334455",
      deliveryAddress: "Office 1204, Business Bay",
      deliveryArea: "Business Bay",
      occasion: "Congratulations",
      deadlineAt: inHours(5),
      approvalDeadline: inMinutes(18),
    },
    {
      orderNumber: "#SHOP-5822",
      source: "SHOPIFY",
      shopifyOrderId: "5822",
      status: "ASSIGNED_DRIVER",
      floristId: mona.id,
      driverId: khalid.id,
      recipientName: "Aisha Rahman",
      recipientPhone: "+971504445566",
      deliveryAddress: "Villa 7, Al Wasl Road",
      deliveryArea: "Al Wasl",
      mapsLink: "https://maps.app.goo.gl/xR3vQmZ9pL2Tn7yV8",
      deadlineAt: inHours(-1),
    },
    {
      orderNumber: "GG-1003",
      source: "WHATSAPP",
      status: "OUT_FOR_DELIVERY",
      floristId: sara.id,
      driverId: ahmed.id,
      recipientName: "Yousef Al Ali",
      recipientPhone: "+971505556677",
      deliveryAddress: "Apt 1502, Downtown Views, Downtown Dubai",
      deliveryArea: "Downtown",
      occasion: "Get well soon",
      deadlineAt: inHours(2),
    },
    {
      orderNumber: "GG-0998",
      source: "WHATSAPP",
      status: "DELIVERED",
      floristId: mona.id,
      driverId: khalid.id,
      recipientName: "Huda Nasser",
      recipientPhone: "+971506667788",
      deliveryAddress: "Villa 3, Umm Suqeim 2",
      deliveryArea: "Umm Suqeim",
      deadlineAt: inHours(-20),
    },
    {
      orderNumber: "GG-0997",
      source: "WHATSAPP",
      status: "DELIVERED",
      floristId: sara.id,
      driverId: ahmed.id,
      recipientName: "Marwan Saeed",
      recipientPhone: "+971507778899",
      deliveryAddress: "Villa 9, Al Safa 2",
      deliveryArea: "Al Safa",
      deadlineAt: inHours(-44),
    },
    {
      orderNumber: "GG-1004",
      source: "WHATSAPP",
      status: "NEW",
      recipientName: "Latifa Obaid",
      recipientPhone: "+971508889900",
      deliveryAddress: "Apt 402, City Walk Residences",
      deliveryArea: "City Walk",
      occasion: "Anniversary",
      deadlineAt: inHours(26),
    },
    {
      orderNumber: "GG-1005",
      source: "WHATSAPP",
      status: "ASSIGNED_FLORIST",
      floristId: sara.id,
      recipientName: "Khalifa Bin Rashid",
      recipientPhone: "+971509990011",
      deliveryAddress: "Villa 15, Emirates Hills",
      deliveryArea: "Emirates Hills",
      occasion: "Congratulations",
      deadlineAt: inHours(31),
    },
  ] as const;

  for (const o of orders) {
    const order = await db.order.create({ data: { ...o } });
    await db.statusEvent.create({
      data: { orderId: order.id, fromStatus: null, toStatus: "NEW", employeeId: ops.id },
    });
    if (order.status !== "NEW") {
      await db.statusEvent.create({
        data: { orderId: order.id, fromStatus: "NEW", toStatus: order.status, employeeId: ops.id },
      });
    }
  }

  console.log("Seeded 1 ops account, 2 florists, 2 drivers, and 9 demo orders across yesterday/today/tomorrow.");
  console.log("PINs — Layla (Ops): 1234, Mona: 1111, Sara: 2222, Khalid: 3333, Ahmed: 4444");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
