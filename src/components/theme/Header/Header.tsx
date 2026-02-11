import {
  MenuHamburgerIcon
} from "@navikt/aksel-icons";
import { Button, Dropdown, Link, Page } from "@navikt/ds-react";
import { useEffect, useState } from "react";
import '../../../tailwind.css';
import { ThemeButton } from '../ThemeButton/ThemeButton';

interface HeaderProps {
  theme: "light" | "dark";
}

export default function Header({ theme }: HeaderProps) {
  const [isMobile, setIsMobile] = useState(false);
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
    "!no-underline !bg-transparent hover:!underline hover:!bg-transparent !font-normal " + (theme === "dark" ? "!text-[var(--ax-text-default)] hover:!text-[var(--ax-text-default)]" : "!text-white hover:!text-white focus:!text-black focus:!bg-blue-100");
  return (
    <div style={{ background: theme === "dark" ? "var(--ax-bg-default)" : "rgba(19,17,54)" }} className="border-b border-[var(--ax-border-neutral-subtle)]">
      <Page.Block width="2xl" gutters>
        <header className="flex py-1 z-10 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button as={Link} variant="tertiary" className={`${linkButton} !px-0`} href="/" aria-label="Start Umami">
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
                  Umami{window.location.hostname.includes('.dev.nav.no') ? ' Dev' : ''}
                </span>
              </div>
            </Button>
          </div>
          {isMobile ? (
            <div className="flex items-center gap-2">
              <ThemeButton />
              <Dropdown>
                <Button as={Dropdown.Toggle} variant="tertiary" className={linkButton}>
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
                  <Dropdown.Menu.List>
                    <Dropdown.Menu.List.Item
                      as={Link}
                      href="/oppsett"
                      className="no-underline"
                    >
                      <span className="whitespace-nowrap">Teknisk oppsett</span>
                    </Dropdown.Menu.List.Item>
                  </Dropdown.Menu.List>
                </Dropdown.Menu>
              </Dropdown>
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
                                <Button
                  as={Link}
                  variant="tertiary"
                  href="/oppsett"
                  className={linkButton}
                >
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap">Tekninsk oppsett</span>
                  </div>
                </Button>
                <ThemeButton />
              </div>
            </div>
          )}
        </header>
      </Page.Block>
    </div>
  );
}
