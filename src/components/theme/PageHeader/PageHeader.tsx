import { BodyLong, BodyShort, Heading, Page } from "@navikt/ds-react";
import React from "react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    description?: React.ReactNode;
    variant?: "regular" | "article";
}

export const PageHeader = ({
    title,
    subtitle,
    description,
    variant = "regular",
}: PageHeaderProps) => {
    const isArticle = variant === "article";
    const padding = isArticle ? "64px" : "32px";

    return (
        <div
            style={{
                width: "100%",
                backgroundColor: "var(--ax-bg-accent-soft)",
                color: "var(--ax-text-default)",
                paddingTop: padding,
                paddingBottom: padding,
                marginBottom: "24px",
            }}
        >
            <Page.Block width="xl" gutters>
                <div
                    className={`flex flex-col gap-[10px] ${isArticle ? "max-w-[800px] mx-auto" : ""
                        }`}
                >
                    <div className="flex flex-col gap-[6px]">
                        <Heading level="1" size="xlarge">
                            {title}
                        </Heading>
                        {subtitle && (
                            <Heading
                                level="2"
                                size="medium"
                                className="text-[var(--ax-text-neutral-subtle)] font-normal"
                            >
                                {subtitle}
                            </Heading>
                        )}
                    </div>

                    {description && (
                        <div className="text-[var(--ax-text-neutral-subtle)]">
                            {typeof description === "string" ? (
                                isArticle ? (
                                    <BodyLong size="large">{description}</BodyLong>
                                ) : (
                                    <BodyShort size="medium">{description}</BodyShort>
                                )
                            ) : (
                                <BodyLong size={isArticle ? "large" : "medium"} as="div">
                                    {description}
                                </BodyLong>
                            )}
                        </div>
                    )}
                </div>
            </Page.Block>
        </div>
    );
};
