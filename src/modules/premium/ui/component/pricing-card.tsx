"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { cva, VariantProps } from "class-variance-authority";
import { CircleCheckIcon } from "lucide-react";

const pricingCardVariants = cva("rounded-lg p-4 py-6 w-full border", {
  variants: {
    variant: {
      default: "bg-white text-black border-gray-200",
      highlighted:
        "bg-gradient-to-br from-blue-50 to-indigo-50 text-gray-900 border-blue-200 shadow-lg ring-1 ring-blue-100",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const pricingIconVariants = cva("size-5", {
  variants: {
    variant: {
      default: "text-green-600",
      highlighted: "text-blue-600",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const pricingCardSecondaryTextVariants = cva("", {
  variants: {
    variant: {
      default: "text-neutral-700",
      highlighted: "text-blue-700",
    },
  },
});

const pricingBadgeVariants = cva("text-xs font-normal px-2 py-1", {
  variants: {
    variant: {
      default: "bg-gray-100 text-gray-800",
      highlighted: "bg-blue-100 text-blue-800",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const pricingTitleVariants = cva("font-medium text-xl", {
  variants: {
    variant: {
      default: "text-gray-900",
      highlighted: "text-blue-900",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const pricingPriceVariants = cva("text-3xl font-medium", {
  variants: {
    variant: {
      default: "text-gray-900",
      highlighted: "text-blue-900",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const pricingFeaturesHeaderVariants = cva("font-medium uppercase text-sm", {
  variants: {
    variant: {
      default: "text-gray-900",
      highlighted: "text-blue-900",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface Props extends VariantProps<typeof pricingCardVariants> {
  badge?: string | null;
  price: number;
  features: string[];
  title: string;
  description?: string | null;
  priceSuffix?: string | null;
  className?: string;
  buttonText?: string;
  onClick?: () => void;
}

export const PricingCard = ({
  variant,
  badge,
  price,
  features,
  title,
  description,
  priceSuffix,
  className,
  buttonText,
  onClick,
}: Props) => {
  return (
    <div className={cn(pricingCardVariants({ variant }), className)}>
      <div className="flex items-end gap-x-4 justify-between">
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <h6 className={cn(pricingTitleVariants({ variant }))}>{title}</h6>
            {badge ? (
              <Badge className={cn(pricingBadgeVariants({ variant }))}>
                {badge}
              </Badge>
            ) : null}
          </div>

          <p
            className={cn(
              "text-xs",
              pricingCardSecondaryTextVariants({ variant })
            )}
          >
            {description}
          </p>
        </div>

        <div className="flex items-end shrink-0 gap-x-0.5">
          <h4 className={cn(pricingPriceVariants({ variant }))}>
            {Intl.NumberFormat("en-Us", {
              style: "currency",
              currency: "INR",
              minimumFractionDigits: 0,
            }).format(price)}
          </h4>
          <span className={cn(pricingCardSecondaryTextVariants({ variant }))}>
            {priceSuffix}
          </span>
        </div>
      </div>

      <div className="py-6">
        <Separator
          className={cn(
            "opacity-20",
            variant === "highlighted" ? "bg-blue-200" : "bg-gray-200"
          )}
        />
      </div>

      <Button
        className="w-full"
        size="lg"
        variant={variant === "highlighted" ? "default" : "outline"}
        onClick={onClick}
      >
        {buttonText}
      </Button>

      <div className="flex flex-col gap-y-2 mt-6">
        <p className={cn(pricingFeaturesHeaderVariants({ variant }))}>
          Features
        </p>
        <ul className={cn("flex flex-col gap-y-2.5")}>
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-x-2.5">
              <CircleCheckIcon
                className={cn(pricingIconVariants({ variant }))}
              />
              <span
                className={cn(
                  "text-sm",
                  variant === "highlighted" ? "text-gray-800" : "text-gray-700"
                )}
              >
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
