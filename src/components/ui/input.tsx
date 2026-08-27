import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full overflow-hidden rounded-[9px] border border-input bg-background px-3 py-2 text-base transition-[background-color,border-color,box-shadow] duration-150 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-semibold file:text-foreground hover:border-foreground/25 hover:file:bg-muted/80 placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60 md:text-sm lg:h-[38px]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
