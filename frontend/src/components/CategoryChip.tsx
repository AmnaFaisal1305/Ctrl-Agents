import { prettyCategory } from "@/lib/format";

export function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-[7px] bg-line-2 px-2.5 py-[3px] text-[12.5px] font-medium capitalize text-[var(--ink-2)]">
      {prettyCategory(category)}
    </span>
  );
}
