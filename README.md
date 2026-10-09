<img src="assets/ui/banner.webp" alt="MarginPilot — экономика товара, цены и акции Ozon" width="100%" />

MarginPilot — внутренняя бэкофис-система для оценки экономики SKU, изменения цен и управления акциями в кабинете Ozon.

[Открыть кейс-сайт](https://onlyuncia.github.io/marginpilot-product-docs/) · [Читать единый кейс](docs/case-marginpilot.md) · [Артефакты на сайте](https://onlyuncia.github.io/marginpilot-product-docs/artifacts.html) · [Карта документов](https://onlyuncia.github.io/marginpilot-product-docs/documents.html) · [Скачать PDF](output/pdf/case-marginpilot.pdf)

## Контекст

С MarginPilot работали **три менеджера по продажам**. Они управляли каталогом примерно из **3600 SKU** в **двух кабинетах Ozon**. В кейсе подробно разобрана схема DBS.

После изменения комиссий или тарифов менеджеры пересчитывали цены в рабочей книге и загружали их в Ozon. Вместе с проверкой результата это занимало **1–4 часа**. Однажды ошибка в шаблоне привела к массовой отправке заниженных цен: часть товаров успела продаться до обнаружения ошибки. Так появилась ключевая задача MarginPilot — проверять экономику цены до отправки.

## Мой вклад

Я собирал требования и проектировал функции MarginPilot как бизнес- и системный аналитик.

| Задача | Мой вклад | Зачем это было нужно | Результат |
| --- | --- | --- | --- |
| Снизить риск заниженных цен | Описал порог и предупреждение; SKU ниже порога включались в пакет только вручную. | Проверять пакет до отправки, сохранив право менеджера на исключение. | Случайные массовые отправки ниже порога после внедрения не повторялись. |
| Разбирать ценовые ошибки | Определил состав журнала: пользователь, время, кабинет, SKU и решение по цене ниже порога. | Восстанавливать ход отправки при инциденте. | Состав пакета и подтверждённые исключения можно было найти по записям. |
| Применять и проверять изменения | Разделил ответ API и фактический результат; описал сверку по SKU и обработку таймаута. | Не принимать отправку за успешное применение в Ozon. | Полный цикл: 1–4 часа → 10–20 минут; проверка цены: 6 → 2 действия. |
| Сопоставлять план и факт | Описал снимок расчёта и выбор версии плана на момент продажи. | Не подменять исторический план последним расчётом. | Менеджер видел отклонение по SKU и фактические расходы, включая рекламу. |

Размеры пакетов различались, поэтому единый процент ускорения не рассчитывался. Период наблюдения за инцидентами не зафиксирован; денежный эффект не оценивался.

## Граница расчёта

На данных 1С и Ozon MarginPilot оценивал **результат одной продажи SKU** при рассматриваемой цене. Спрос и будущий объём продаж система не прогнозировала.

## Ключевые диаграммы

<img src="assets/ui/price-flow.webp" alt="Путь пакета цен: расчёт, проверка порога, решение менеджера, отправка в Ozon и сверка" width="100%" />

<table>
  <tr>
    <td width="50%" align="center"><a href="assets/bpmn-bp01-as-is.svg"><img src="assets/bpmn-bp01-as-is.svg" alt="БП-01 до внедрения" width="100%" /></a><br /><sub>До: ручная подготовка и проверка цен</sub></td>
    <td width="50%" align="center"><a href="assets/bpmn-bp01-to-be.svg"><img src="assets/bpmn-bp01-to-be.svg" alt="БП-01 после внедрения" width="100%" /></a><br /><sub>После: проверка порога до отправки</sub></td>
  </tr>
</table>

- [Контейнерная диаграмма C4](assets/c4-container-marginpilot.svg).
- [ER-диаграмма проектной базы данных](assets/database-schema.png).
- [Состояния пакета и результата по SKU](assets/state-batch-sku.svg).

## Аналитические артефакты

### Бизнес-анализ

- [Бизнес-процессы: до и после внедрения](docs/02-PROCESS-AS-IS-TO-BE.md)
- [Функциональные требования](docs/03-FUNCTIONAL-REQUIREMENTS.md)
- [Бизнес-метрики и результаты](docs/04-RESULTS.md)
- [Ограничения и зависимости](docs/05-CONSTRAINTS-DEPENDENCIES.md)
- [Риски и меры снижения](docs/06-RISKS-MITIGATION.md)
- [Стейкхолдеры](docs/07-STAKEHOLDERS.md)
- [Успех проекта](docs/08-PROJECT-SUCCESS.md)
- [Планы расширения](docs/09-EXPANSION-PLANS.md)

### Системный анализ

- [Архитектура системы: контейнерная диаграмма C4](docs/01-SYSTEM-ARCHITECTURE.md)
- [Use Cases: цены, акции и план-факт SKU](docs/10-USE-CASES.md)
- [Нефункциональные требования](docs/11-NON-FUNCTIONAL-REQUIREMENTS.md)
- [Критерии приёмки](docs/16-ACCEPTANCE-CRITERIA.md)

### Технические приложения

- [Backend-логика](docs/12-BACKEND-LOGIC.md)
- [HTTP-контракт внутреннего API (реконструкция)](docs/13-HTTP-CONTRACT.md)
- [Проектная схема БД (DBML)](14-DATABASE-SCHEMA.dbml)
- [OpenAPI-спецификация внутреннего API (реконструкция)](15-OPENAPI.json)

## Форматы и инструменты

### Модели и контракты

[![BPMN 2.0](assets/ui/badge-bpmn.svg)](assets/bpmn-bp01-to-be.bpmn) [![C4](assets/ui/badge-c4.svg)](docs/01-SYSTEM-ARCHITECTURE.md) [![Mermaid](assets/ui/badge-mermaid.svg)](docs/12-BACKEND-LOGIC.md) [![DBML](assets/ui/badge-dbml.svg)](14-DATABASE-SCHEMA.dbml) [![OpenAPI 3.1](assets/ui/badge-openapi.svg)](15-OPENAPI.json)

### API и данные

[![SwaggerHub](assets/ui/badge-swaggerhub.svg)](https://portal.swaggerhub.com/apis/grafio/api-marginpilot/1.0.0) [![PostgreSQL](assets/ui/badge-postgresql.svg)](14-DATABASE-SCHEMA.dbml) [![SQL](assets/ui/badge-sql.svg)](docs/12-BACKEND-LOGIC.md)
<img src="assets/ui/divider.webp" alt="" width="100%" />

OpenAPI реконструирован для кейса; SwaggerHub используется для публикации спецификации. Примеры для портфолио обезличены.
