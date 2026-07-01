import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      className={cn("flex flex-col gap-3", className)}
      data-slot="radio-group"
      {...props}
    />
  )
}

function Radio({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border border-input bg-background not-dark:bg-clip-padding shadow-xs/5 outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-full not-data-disabled:not-data-[state=checked]:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/48 data-disabled:opacity-64 sm:size-4 dark:not-data-[state=checked]:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:not-data-disabled:not-data-[state=checked]:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [[data-disabled],[data-state=checked],[aria-invalid]]:shadow-none",
        className,
      )}
      data-slot="radio"
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className="-inset-px absolute flex size-4.5 items-center justify-center rounded-full before:size-2 before:rounded-full before:bg-primary-foreground data-[state=unchecked]:hidden data-[state=checked]:bg-primary sm:size-4 sm:before:size-1.5"
        data-slot="radio-indicator"
      />
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, Radio, Radio as RadioGroupItem }
