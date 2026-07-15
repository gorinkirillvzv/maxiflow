#!/bin/bash
# Maxiflow — публикатор отложенных постов. Запускается systemd-таймером раз в минуту
# (unit maxiflow-publisher.timer). Дёргает защищённый секретом cron-эндпоинт кабинета.
SECRET=$(grep '^CRON_SECRET=' /opt/kaskad/.env.local | cut -d= -f2-)
curl -s -m 50 -X POST \
  -H "x-cron-key: ${SECRET}" \
  http://localhost:3100/api/cron/publish-scheduled
echo
exit 0
