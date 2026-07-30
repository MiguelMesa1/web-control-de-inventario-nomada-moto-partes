import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  transparent = false,
  className,
}: {
  compact?: boolean;
  transparent?: boolean;
  className?: string;
}) {
  const source = transparent
    ? "/brand/nomada-wordmark-login.png"
    : "/brand/nomada-wordmark.png";

  if (compact) {
    return (
      <div
        className={cn(
          "relative size-11 shrink-0 overflow-hidden rounded-xl shadow-[0_0_24px_rgba(240,227,0,0.22)]",
          !transparent && "bg-black",
        )}
        aria-label="Nómada Moto Partes"
      >
        <Image
          src="/brand/nomada-elephant.png"
          alt=""
          fill
          priority
          sizes="44px"
        className={cn("scale-[3.05] object-contain", transparent && "mix-blend-screen")}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-[4.25rem] w-full max-w-[15.5rem] overflow-hidden rounded-xl shadow-[0_0_28px_rgba(240,227,0,0.16)]",
        !transparent && "bg-black",
        className,
      )}
      aria-label="Nómada Moto Partes"
    >
      <Image
        src={source}
        alt=""
        fill
        priority
        sizes={transparent ? "(min-width: 640px) 368px, 304px" : "248px"}
        className="scale-[1.17] object-contain"
      />
    </div>
  );
}
