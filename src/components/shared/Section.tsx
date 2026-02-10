import { Box } from "@navikt/ds-react";
import { ReactNode, CSSProperties } from "react";

interface SectionProps {
  children: ReactNode;
  background?: "default" | "accent-soft";
  padding?: "space-8" | "space-12" | "space-16" | "space-20";
  style?: CSSProperties;
}

export const Section = ({
  children,
  background,
  padding = "space-12",
  style,
}: SectionProps) => {
  return (
    <Box background={background} paddingBlock={padding} style={style}>
      {children}
    </Box>
  );
};
