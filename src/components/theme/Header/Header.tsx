import {
  MenuHamburgerIcon,
  BookIcon
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
    "flex no-underline items-center bg-transparent hover:underline hover:bg-transparent navds-button navds-button--primary navds-button--medium  text-white hover:text-white";
  return (
    <div style={{ background: "rgba(19,17,54)" }}>
    <header className="flex py-1 z-10 items-center max-w-[76.5rem] m-auto justify-between">
      <div className="flex items-stretch">
        <Link className={linkButton} href="/">
          <span className="text-2xl whitespace-nowrap text-white">
            Start Umami
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
{/*              <Dropdown.Menu.List.Item
                  as={Link}
                  href="/utvidelser"
                  className="no-underline"
              >
                <MenuGridIcon aria-hidden fontSize="1.5rem" />
                <span className="whitespace-nowrap">Utvidelser</span>
              </Dropdown.Menu.List.Item>*/}
              <Dropdown.Menu.List.Item
                as={Link}
                href="/komigang"
                className="no-underline"
              >
                <BookIcon aria-hidden fontSize="1.5rem" />
                <span className="whitespace-nowrap">Kom i gang guide</span>
              </Dropdown.Menu.List.Item>
            </Dropdown.Menu.List>
          </Dropdown.Menu>
        </Dropdown>
      ) : (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center w-full"></div>
          <div className="flex flex-grow">
{/*            <Link
                href="/utvidelser"
                className={linkButton}
            >
              <MenuGridIcon aria-hidden fontSize="1.5rem" />
              <span className="whitespace-nowrap">Utvidelser</span>
            </Link>*/}
            <Link
              href="/komigang"
              className={linkButton}
            >
              <BookIcon aria-hidden fontSize="1.5rem" />
              <span className="whitespace-nowrap">Kom i gang guide</span>
            </Link>
          </div>
        </div>
      )}
    </header>
    </div>
  );
}
