import { IdentityBootstrap } from "./identity-bootstrap";
import { NavLinks } from "./nav-links";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <IdentityBootstrap>
          <header
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #ddd",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <NavLinks />
          </header>
          {children}
        </IdentityBootstrap>
      </body>
    </html>
  );
}
