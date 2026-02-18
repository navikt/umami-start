import { CogIcon, MenuHamburgerIcon } from "@navikt/aksel-icons";
import { ActionMenu, Button, Dropdown, Link, Page, Tooltip } from "@navikt/ds-react";
import { useEffect, useState } from "react";
import "../../../tailwind.css";
import { ThemeButton } from "../ThemeButton/ThemeButton.tsx";

interface HeaderProps {
  theme: "light" | "dark";
}

type MenuLink = {
  href: string;
  label: string;
};

export default function Header({ theme }: HeaderProps) {
  const [isMobile, setIsMobile] = useState(false);
  const { hostname, pathname, search, hash } = window.location;
  const currentPath = `${pathname}${search}${hash}`;

  const guideLinks = [
    { href: "/komigang", label: "Oppsett guide" },
    {
      href: "https://navno.sharepoint.com/sites/intranett-utvikling/SitePages/Rutine-for-bruk-av-Umami.aspx",
      label: "Retningslinjer",
    },
    { href: "/taksonomi", label: "Taksonomi" },
  ];

  const developerLinks = [
    { href: "/sporingskoder", label: "Sporingskoder" },
    { href: "/sql", label: "SQL-editor" },
    { href: "/personvernssjekk", label: "Personvernsjekk" },
    { href: "/diagnose", label: "Diagnoseverktøy" },
  ];

  const environmentLinks: MenuLink[] = (() => {
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isDev = hostname.includes(".dev.nav.no");
    const isProd = hostname.includes(".nav.no") && !isDev;

    if (isLocalhost) {
      return [
        {
          href: `https://startumami.ansatt.dev.nav.no${currentPath}`,
          label: "Gå til dev-miljø",
        },
        {
          href: `https://startumami.ansatt.nav.no${currentPath}`,
          label: "Gå til prod-miljø",
        },
      ];
    }

    if (isDev) {
      const prodHostname = hostname.replace(".dev.nav.no", ".nav.no");
      return [
        {
          href: `https://${prodHostname}${currentPath}`,
          label: "Gå til prod-miljø",
        },
      ];
    }

    if (isProd) {
      const devHostname = hostname.replace(".nav.no", ".dev.nav.no");
      return [
        {
          href: `https://${devHostname}${currentPath}`,
          label: "Gå til dev-miljø",
        },
      ];
    }

    return [];
  })();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const linkButton =
    "!no-underline !bg-transparent hover:!underline hover:!bg-transparent !font-normal " +
    (theme === "dark"
      ? "!text-[var(--ax-text-default)] hover:!text-[var(--ax-text-default)]"
      : "!text-white hover:!text-white focus:!text-black focus:!bg-blue-100");

  const setupMenu = (
    <ActionMenu>
      <Tooltip content="Teknisk meny" describesChild>
        <ActionMenu.Trigger>
          <Button
            variant="tertiary-neutral"
            icon={<CogIcon aria-hidden />}
            aria-label="Teknisk meny"
            className="!text-white hover:!bg-blue-100 hover:!text-black active:!bg-blue-100 active:!text-black focus:!bg-blue-100 focus:!text-black"
          />
        </ActionMenu.Trigger>
      </Tooltip>
      <ActionMenu.Content align="end">
        <ActionMenu.Group label="Veiledninger">
          {guideLinks.map((item) => (
            <ActionMenu.Item key={item.href} as="a" href={item.href}>
              {item.label}
            </ActionMenu.Item>
          ))}
        </ActionMenu.Group>
        <ActionMenu.Divider />
        <ActionMenu.Group label="Utviklerverktøy">
          {developerLinks.map((item) => (
            <ActionMenu.Item key={item.href} as="a" href={item.href}>
              {item.label}
            </ActionMenu.Item>
          ))}
        </ActionMenu.Group>
        {environmentLinks.length > 0 && (
          <>
            <ActionMenu.Divider />
            <ActionMenu.Group label="Miljø">
              {environmentLinks.map((item) => (
                <ActionMenu.Item key={item.href} as="a" href={item.href}>
                  {item.label}
                </ActionMenu.Item>
              ))}
            </ActionMenu.Group>
          </>
        )}
      </ActionMenu.Content>
    </ActionMenu>
  );

  return (
    <div
      style={{
        background:
          theme === "dark" ? "var(--ax-bg-default)" : "rgba(19,17,54)",
      }}
      className="border-b border-[var(--ax-border-neutral-subtle)]"
    >
      <Page.Block width="2xl" gutters>
        <header className="flex py-1 z-10 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              as={Link}
              variant="tertiary"
              className={`${linkButton} !px-0`}
              href="/"
              aria-label="Start Umami"
            >
              <div className="flex items-center gap-2">
                <svg
                  width="1em"
                  height="1em"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-2xl"
                  aria-hidden="true"
                >
                  <path
                    d="M5 4L19 12L5 20V4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-2xl whitespace-nowrap">
                  Umami
                  {window.location.hostname.includes(".dev.nav.no")
                    ? " Dev"
                    : ""}
                </span>
              </div>
            </Button>
          </div>
          {isMobile ? (
            <div className="flex items-center gap-2">
              <ThemeButton />
              <Dropdown>
                <Button
                  as={Dropdown.Toggle}
                  variant="tertiary"
                  className={linkButton}
                >
                  <MenuHamburgerIcon title="meny" fontSize="1.5rem" />
                </Button>
                <Dropdown.Menu className="w-auto">
                  <Dropdown.Menu.List>
                    <Dropdown.Menu.List.Item
                      as={Link}
                      href="/grafbygger"
                      className="no-underline"
                    >
                      <span className="whitespace-nowrap">Grafbygger</span>
                    </Dropdown.Menu.List.Item>
                  </Dropdown.Menu.List>
                </Dropdown.Menu>
              </Dropdown>
              {setupMenu}
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center w-full"></div>
              <div className="flex flex-grow">
                <Button
                  as={Link}
                  variant="tertiary"
                  href="/grafbygger"
                  className={linkButton}
                >
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap">Grafbygger</span>
                  </div>
                </Button>
                {setupMenu}
                <ThemeButton />
              </div>
            </div>
          )}
        </header>
      </Page.Block>
    </div>
  );
}
