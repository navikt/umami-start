import { Box } from "@navikt/ds-react";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card = ({ children, className }: CardProps) => {
  return (
    <Box
      background="default"
      padding="space-36"
      borderRadius="12"
      borderWidth="1"
      borderColor="neutral-subtle"
      className={className}
      marginBlock="space-24"
      marginInline="space-24"
    >
      {children}
    </Box>
  );
};
