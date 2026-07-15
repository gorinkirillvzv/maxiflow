import type { Metadata } from "next";
import { Onest, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import YandexMetrika from "@/components/YandexMetrika";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Maxiflow — подписки MAX из Яндекс Директа",
  description:
    "Maxiflow связывает рекламу в Яндекс Директе с подписками на канал в MAX: считает реальную цену подписчика, выдаёт лид-магнит и ведёт по воронке.",
  verification: {
    yandex: "00c77c5b23bebf07",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${onest.variable} ${jetbrainsMono.variable}`}>
      <body>
        <YandexMetrika />
        {children}
      </body>
    </html>
  );
}
