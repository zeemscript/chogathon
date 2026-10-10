import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Chogathon-style: mono uppercase, hard offset shadow, shine sweep, lift on hover.
const buttonVariants = cva(
  "group/button shine inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-transparent bg-clip-padding font-mono text-[12.5px] font-medium tracking-[0.1em] whitespace-nowrap uppercase transition-all duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-chog bg-chog text-white shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_rgba(0,0,0,.55),0_0_20px_rgba(131,110,249,.45)] active:translate-0 active:shadow-[1px_1px_0_rgba(0,0,0,.55)]",
        hero:
          "rounded-[13px] bg-[linear-gradient(135deg,#a99bfc_0%,#836ef9_55%,#6f52e8_100%)] text-white shadow-[5px_5px_0_rgba(0,0,0,.55),0_18px_34px_-16px_rgba(131,110,249,.95)] hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-[8px_8px_0_rgba(0,0,0,.55),0_22px_44px_-16px_rgba(131,110,249,1)] active:translate-0 active:shadow-[1px_1px_0_rgba(0,0,0,.55)]",
        ok: "border-chog-ok bg-chog-ok text-night shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-0",
        outline:
          "border-line-bright bg-white/[.04] text-foreground backdrop-blur-md after:hidden hover:border-chog-soft hover:bg-chog/10 hover:text-white",
        secondary: "border-border bg-secondary text-secondary-foreground after:hidden hover:border-line-bright hover:bg-night-3",
        ghost: "text-muted-foreground after:hidden hover:bg-white/5 hover:text-foreground",
        destructive:
          "bg-destructive/15 text-destructive after:hidden hover:bg-destructive/25 focus-visible:ring-destructive/20",
        link: "text-chog-soft underline-offset-4 after:hidden hover:underline",
      },
      size: {
        default: "h-11 gap-2.5 px-6",
        xs: "h-7 gap-1 px-2.5 text-[10.5px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 text-[11.5px]",
        lg: "h-14 gap-2.5 px-8 text-[13px] tracking-[0.08em]",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
