import {
  MenuHamburgerIcon,
  AreaChartIcon,
  NumberListIcon,
  BellIcon
} from "@navikt/aksel-icons";
import { Button, Dropdown, Link, Page, Alert, Heading } from "@navikt/ds-react";
import { useEffect, useState } from "react";
import '../../../tailwind.css';
import { ThemeButton } from '../ThemeButton/ThemeButton';

interface HeaderProps {
  theme: "light" | "dark";
}

export default function Header({ theme }: HeaderProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showAlertBadge, setShowAlertBadge] = useState(false);
  const [isAlertDropdownOpen, setIsAlertDropdownOpen] = useState(false);

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

  useEffect(() => {
    const dismissed = localStorage.getItem('umami-banner-dismissed');
    setShowAlertBadge(dismissed !== 'true');
  }, []);

  const handleDismissAlert = () => {
    localStorage.setItem('umami-banner-dismissed', 'true');
    setShowAlertBadge(false);
    setIsAlertDropdownOpen(false);
  };

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
              {/* Alerts Dropdown */}
              <Dropdown open={isAlertDropdownOpen} onOpenChange={setIsAlertDropdownOpen}>
                <Button as={Dropdown.Toggle} variant="tertiary" className={`${linkButton} relative`}>
                  <BellIcon title="varsler" fontSize="1.5rem" />
                  {showAlertBadge && (
                    <span 
                      className="absolute block h-2 w-2 rounded-full bg-red-600"
                      style={{ top: '4px', right: '4px' }}
                    ></span>
                  )}
                </Button>
                <Dropdown.Menu className="w-auto" style={{ minWidth: '320px', maxWidth: '400px' }}>
                  <div style={{ padding: '16px' }}>
                    <Alert variant="error" closeButton onClose={handleDismissAlert}>
                      <Heading spacing as="h3" size="xsmall">Nyhet: Hardt skille mellom dev og prod</Heading>
                      NB: Det arbeides med å flytte over dev-apper til det nye dev-miljøet.
                    </Alert>
                  </div>
                </Dropdown.Menu>
              </Dropdown>
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
                      <AreaChartIcon aria-hidden fontSize="1.5rem" />
                      <span className="whitespace-nowrap">Grafbygger</span>
                    </Dropdown.Menu.List.Item>
                    <Dropdown.Menu.List.Item
                      as={Link}
                      href="/sporingskoder"
                      className="no-underline"
                    >
                      <NumberListIcon aria-hidden fontSize="1.5rem" />
                      <span className="whitespace-nowrap">Sporingskoder</span>
                    </Dropdown.Menu.List.Item>
                  </Dropdown.Menu.List>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center w-full"></div>
              <div className="flex flex-grow items-center">
                <Button
                  as={Link}
                  variant="tertiary"
                  href="/grafbygger"
                  className={linkButton}
                >
                  <div className="flex items-center gap-2">
                    <AreaChartIcon aria-hidden fontSize="1.5rem" />
                    <span className="whitespace-nowrap">Grafbygger</span>
                  </div>
                </Button>
                <Button
                  as={Link}
                  variant="tertiary"
                  href="/sporingskoder"
                  className={linkButton}
                >
                  <div className="flex items-center gap-2">
                    <NumberListIcon aria-hidden fontSize="1.5rem" />
                    <span className="whitespace-nowrap">Sporingskoder</span>
                  </div>
                </Button>
                {/* Alerts Dropdown */}
                <Dropdown open={isAlertDropdownOpen} onOpenChange={setIsAlertDropdownOpen}>
                  <Button as={Dropdown.Toggle} variant="tertiary" className={`${linkButton} relative`}>
                    <BellIcon title="varsler" fontSize="1.5rem" />
                    {showAlertBadge && (
                      <span 
                        className="absolute block h-2 w-2 rounded-full bg-red-600"
                        style={{ top: '4px', right: '4px' }}
                      ></span>
                    )}
                  </Button>
                  <Dropdown.Menu className="w-auto" style={{ minWidth: '320px', maxWidth: '400px' }}>
                    <div style={{ padding: '16px' }}>
                      <Alert variant="error" closeButton onClose={handleDismissAlert}>
                        <Heading spacing as="h3" size="xsmall">Nyhet: Hardt skille mellom dev og prod</Heading>
                        NB: Det arbeides med å flytte over dev-apper til det nye dev-miljøet.
                      </Alert>
                    </div>
                  </Dropdown.Menu>
                </Dropdown>
                <ThemeButton />
              </div>
            </div>
          )}
        </header>
      </Page.Block>
    </div>
  );
}
