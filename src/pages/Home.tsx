import { Heading, Link, Alert, Box, Bleed } from "@navikt/ds-react";
import UrlSearchForm from "../components/dashboard/UrlSearchForm";
import { Card, Section } from "../components/shared";
import { Page } from "../components/Page";
import { useState, useEffect, ReactNode } from "react";

const BannerSection = ({ onDismiss }: { onDismiss: () => void }): ReactNode => {
  return (
    <Page.Block width="xl" gutters>
      <Bleed reflectivePadding marginInline="full" asChild>
        <Section padding="space-8">
          <Alert variant="error" closeButton onClose={onDismiss}>
            <Heading spacing as="h3" size="xsmall">
              Nyhet: Hardt skille mellom dev og prod
            </Heading>
            NB: Det arbeides med å flytte over dev-apper til det nye
            dev-miljøet.
          </Alert>
        </Section>
      </Bleed>
    </Page.Block>
  );
};

const HeroSection = (): ReactNode => {
  return (
    <Page.Block width="xl" gutters style={{ height: "100%" }}>
      <Bleed
        style={{ height: "100%" }}
        reflectivePadding
        marginInline="full"
        asChild
      >
        <Box style={{ height: "100%" }} background="accent-soft">
          <Section
            padding="space-16"
            style={{
              maxWidth: "600px",
              height: "100%",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Heading spacing={true} as="h1" size="xlarge">
              Mål brukeradferd med Umami
            </Heading>
            <div style={{ width: "100%" }}>
              <UrlSearchForm />
            </div>
          </Section>
        </Box>
      </Bleed>
    </Page.Block>
  );
};

const GuidesSection = (): ReactNode => {
  const guides = [
    {
      href: "/komigang",
      label: "Oppsett guide",
      description: "Sett opp Umami for din nettside",
    },
    {
      href: "https://navno.sharepoint.com/sites/intranett-utvikling/SitePages/Rutine-for-bruk-av-Umami.aspx",
      label: "Retningslinjer",
      description: "Rutine for bruk av Umami",
    },
    {
      href: "/taksonomi",
      label: "Taksonomi",
      description: "Navngi hendelser og egenskaper",
    },
  ];

  return (
    <Page.Block width="xl" gutters style={{ paddingBlock: "40px" }}>
      <Section>
        <Heading as="h2" size="medium" spacing>
          Veiledninger
        </Heading>

        <Box
          as="div"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          {guides.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                backgroundColor: "var(--ax-bg-default)",
                borderRadius: "12px",
                textDecoration: "none",
                color: "var(--ax-text-default)",
                border: "1px solid var(--ax-border-neutral-subtle)",
                transition: "all 0.2s ease",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor =
                  "var(--ax-border-neutral-strong)";
                e.currentTarget.style.backgroundColor =
                  "var(--ax-bg-neutral-soft)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor =
                  "var(--ax-border-neutral-subtle)";
                e.currentTarget.style.backgroundColor = "var(--ax-bg-default)";
              }}
            >
              <div>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                  {guide.label}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "var(--ax-text-subtle)",
                    fontWeight: 400,
                  }}
                >
                  {guide.description}
                </div>
              </div>
              <span
                style={{
                  color: "var(--ax-bg-accent-strong)",
                  fontSize: "18px",
                  marginLeft: "16px",
                }}
              >
                →
              </span>
            </Link>
          ))}
        </Box>
      </Section>
    </Page.Block>
  );
};

const FooterSection = (): ReactNode => {
  return (
    <Page.Block width="xl" gutters>
      <Bleed
        style={{ paddingBlock: "40px" }}
        reflectivePadding
        marginInline="full"
        asChild
      >
        <Box background="accent-soft">
          <Section background="accent-soft">
            <Heading as="h3" size="medium" spacing>
              Få hjelp med Umami
            </Heading>

            <Box
              as="div"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "24px",
              }}
            >
              <Card>
                <Link
                  href="https://nav-it.slack.com/archives/C02UGFS2J4B"
                  target="_blank"
                >
                  <Heading as="h3" size="medium">
                    Chat med ResearchOps
                  </Heading>
                </Link>
                <p>
                  Bli med i Slack-kanalen{" "}
                  <Link
                    href="https://nav-it.slack.com/archives/C02UGFS2J4B"
                    target="_blank"
                  >
                    #researchops
                  </Link>{" "}
                  for å stille spørsmål og få hjelp.
                </p>
              </Card>

              <Card>
                <Link
                  href="https://outlook.office365.com/owa/calendar/TeamResearchOps@nav.no/bookings/"
                  target="_blank"
                >
                  <Heading as="h3" size="medium">
                    Du kan også booke en samtale
                  </Heading>
                </Link>
                <p>
                  <Link
                    href="https://outlook.office365.com/owa/calendar/TeamResearchOps@nav.no/bookings/"
                    target="_blank"
                  >
                    Book en prat 1:1 eller workshop
                  </Link>{" "}
                  med ResearchOps-teamet.
                </p>
              </Card>
            </Box>
          </Section>
        </Box>
      </Bleed>
    </Page.Block>
  );
};

function Home() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("umami-banner-dismissed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowBanner(dismissed !== "true");
  }, []);

  const handleDismissBanner = () => {
    localStorage.setItem("umami-banner-dismissed", "true");
    setShowBanner(false);
  };

  return (
    <Page
      footer={
        <>
          <GuidesSection />
          <FooterSection />
        </>
      }
      offsetHeight={"65px"}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: showBanner ? "auto 1fr" : "1fr",
          height: "100%",
        }}
      >
        {showBanner && <BannerSection onDismiss={handleDismissBanner} />}
        <HeroSection />
      </div>
    </Page>
  );
}

export default Home;
