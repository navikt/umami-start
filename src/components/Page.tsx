import { ReactNode, CSSProperties, ElementType } from "react";

// Custom Page component inspired by Aksel
// because we struggled to style a wrapper div

interface PageProps {
  children: ReactNode;
  footer?: ReactNode;
  contentBlockPadding?: "none" | "end";
  footerPosition?: "sticky" | "belowFold";
  /** Height to subtract from 100vh (e.g., header height). Can be a number (px) or string (e.g., "65px", "var(--header-height)") */
  offsetHeight?: number | string;
  style?: CSSProperties;
}

interface PageBlockProps {
  children: ReactNode;
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "text";
  gutters?: boolean;
  as?: ElementType;
  style?: CSSProperties;
  className?: string;
}

const widthMap = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
  text: "700px",
};

const PageBlock = ({
  children,
  width = "xl",
  gutters = false,
  as: Component = "div",
  style,
  className,
}: PageBlockProps) => {
  const maxWidth = widthMap[width];

  return (
    <Component
      style={{
        maxWidth,
        marginLeft: "auto",
        marginRight: "auto",
        paddingLeft: gutters ? "1rem" : undefined,
        paddingRight: gutters ? "1rem" : undefined,
        ...style,
      }}
      className={className}
    >
      {children}
    </Component>
  );
};

const Page = ({
  children,
  footer,
  contentBlockPadding = "none",
  footerPosition = "sticky",
  offsetHeight,
  style,
}: PageProps) => {
  const paddingBottom = contentBlockPadding === "end" ? "4rem" : undefined;

  // Calculate minHeight based on offsetHeight
  const getMinHeight = () => {
    if (!offsetHeight) return "100vh";
    const offset =
      typeof offsetHeight === "number" ? `${offsetHeight}px` : offsetHeight;
    return `calc(100vh - ${offset})`;
  };

  const minHeight = getMinHeight();

  // Use grid for sticky footer (default)
  // Grid creates a simpler, more reliable layout than flexbox for this pattern
  if (footerPosition === "sticky" && footer) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateRows: "1fr auto",
          minHeight,
          ...style,
        }}
        data-component="Page"
      >
        <div style={{ paddingBottom }}>{children}</div>
        <div>{footer}</div>
      </div>
    );
  }

  // For belowFold, content takes full viewport height and footer scrolls in below
  if (footerPosition === "belowFold" && footer) {
    return (
      <>
        <div style={{ minHeight, paddingBottom, ...style }}>{children}</div>
        <div>{footer}</div>
      </>
    );
  }

  // No footer case
  return <div style={{ paddingBottom, ...style }}>{children}</div>;
};

Page.Block = PageBlock;

export { Page };
