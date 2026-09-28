import React from 'react'
import { Input, Select, ListBox, Label, Chip } from '@heroui/react'

const CHIPS = [
  ['all', 'ทั้งหมด'],
  ['pct', 'ลด %'],
  ['b1g1', 'ซื้อ 1 แถม 1'],
  ['b2f1', 'ซื้อ 2 แถม 1'],
  ['full', 'ราคาเต็ม'],
]

function HeroSelect({ value, onChange, title, items, ariaLabel }) {
  const current = items.find(i => i.value === value)
  return (
    <Select
      aria-label={ariaLabel}
      title={title}
      className="w-44"
      value={value}
      onChange={v => onChange(v)}
    >
      <Select.Trigger>
        <Select.Value>{current?.label ?? ''}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map(i => (
            <ListBox.Item key={i.value} id={i.value} textValue={i.label}>
              {i.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

export default function Controls({ q, setQ, filter, setFilter, minDisc, setMinDisc, sort, setSort }) {
  return (
    <div className="controls flex flex-col gap-3 mb-4">
      <Input
        type="search" autoFocus
        aria-label="ค้นหา"
        placeholder="ค้นหาเลขเซ็ตหรือชื่อ เช่น 10305, Batman, Orchid, McLaren…"
        value={q}
        onChange={e => setQ(e.target.value)}
        className="w-full"
      />
      <div className="row flex flex-wrap gap-3 items-center justify-between">
        <div className="chips flex flex-wrap gap-1.5">
          {CHIPS.map(([v, label]) => (
            <Chip
              key={v}
              as="button"
              onClick={() => setFilter(v)}
              color={filter === v ? 'primary' : 'default'}
              variant={filter === v ? 'solid' : 'soft'}
              className="cursor-pointer select-none"
            >
              {label}
            </Chip>
          ))}
        </div>
        <div className="right flex flex-wrap gap-2 items-center">
          <HeroSelect
            value={minDisc} onChange={v => setMinDisc(Number(v))}
            title="ส่วนลดขั้นต่ำ" ariaLabel="ส่วนลดขั้นต่ำ"
            items={[0, 15, 20, 25, 30, 40, 50, 70].map(v => ({
              value: String(v), label: v === 0 ? 'ส่วนลดทุกระดับ' : `${v}% ขึ้นไป`,
            }))}
          />
          <HeroSelect
            value={sort} onChange={setSort}
            title="เรียงลำดับ" ariaLabel="เรียงลำดับ"
            items={[
              { value: 'item', label: 'เรียง: เลขเซ็ต' },
              { value: 'disc-desc', label: '%ลด มาก → น้อย' },
              { value: 'save-desc', label: 'ประหยัดมาก → น้อย' },
              { value: 'price-desc', label: 'ราคาเต็ม สูง → ต่ำ' },
              { value: 'price-asc', label: 'ราคาเต็ม ต่ำ → สูง' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
