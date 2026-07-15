// Maxiflow — Сегменты и теги. Управление метками для подписчиков.
import { Shell } from "@/components/Shell";
import { TagsManager } from "@/components/TagsManager";

export default function SegmentsPage() {
  return (
    <Shell active="segments" title="Сегменты и теги" breadcrumbs={["Аудитория", "Сегменты и теги"]}>
      <div style={{ padding: "20px 24px", maxWidth: 720 }}>
        <div className="kk-sm kk-muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
          Теги — это метки, которые вы ставите подписчикам. По ним фильтруете аудиторию
          в «Подписчиках» и шлёте целевые рассылки.
        </div>
        <TagsManager />
      </div>
    </Shell>
  );
}
