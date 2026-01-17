import {
  MenuHamburgerIcon,
  ComponentIcon,
  CogIcon,
  BarChartIcon
} from "@navikt/aksel-icons";
import { Button, Dropdown, Link } from "@navikt/ds-react";
import { useEffect, useState } from "react";
import '../../../tailwind.css';

export default function Header() {
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
    "flex !no-underline items-center !bg-transparent hover:!underline hover:!bg-transparent navds-button navds-button--primary navds-button--medium  !text-white hover:!text-white";
  return (
    <div style={{ background: "rgba(19,17,54)" }}>
      <header className="flex py-1 z-10 items-center max-w-[76.5rem] m-auto justify-between">
        <div className="flex items-stretch">
          <Link className={linkButton} href="/" aria-label="Start Umami">
            <svg
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-2xl mr-1"
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
            <span className="text-2xl whitespace-nowrap text-white">
              Umami
            </span>
          </Link>
        </div>
        {isMobile ? (
          <Dropdown>
            <Button as={Dropdown.Toggle} className={linkButton}>
              <MenuHamburgerIcon title="meny" fontSize="1.5rem" />
            </Button>
            <Dropdown.Menu className="w-auto">
              <Dropdown.Menu.List>
                <Dropdown.Menu.List.Item
                  as={Link}
                  href="/dashboards"
                  className="no-underline"
                >
                  <BarChartIcon aria-hidden fontSize="1.5rem" />
                  <span className="whitespace-nowrap">Dashboard</span>
                </Dropdown.Menu.List.Item>
                <Dropdown.Menu.List.Item
                  as={Link}
                  href="/taksonomi"
                  className="no-underline"
                >
                  <ComponentIcon aria-hidden fontSize="1.5rem" />
                  <span className="whitespace-nowrap">Taksonomi</span>
                </Dropdown.Menu.List.Item>
                <Dropdown.Menu.List.Item
                  as={Link}
                  href="/oppsett"
                  className="no-underline"
                >
                  <CogIcon aria-hidden fontSize="1.5rem" />
                  <span className="whitespace-nowrap">Oppsett</span>
                </Dropdown.Menu.List.Item>
              </Dropdown.Menu.List>
            </Dropdown.Menu>
          </Dropdown>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center w-full"></div>
            <div className="flex flex-grow">
              <Link
                href="/dashboards"
                className={linkButton}
              >
                <BarChartIcon aria-hidden fontSize="1.5rem" />
                <span className="whitespace-nowrap">Dashboard</span>
              </Link>
              <Link
                href="/taksonomi"
                className={linkButton}
              >
                <ComponentIcon aria-hidden fontSize="1.5rem" />
                <span className="whitespace-nowrap">Taksonomi</span>
              </Link>
              <Link
                href="/oppsett"
                className={linkButton}
              >
                <CogIcon aria-hidden fontSize="1.5rem" />
                <span className="whitespace-nowrap">Oppsett</span>
              </Link>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
