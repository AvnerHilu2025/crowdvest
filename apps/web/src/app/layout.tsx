import "./globals.css";
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
          <div className="app-shell">
            <header className="app-header">
              <NavLinks />
            </header>
            <main className="app-main">{children}</main>
          </div>
        </IdentityBootstrap>
      </body>
    </html>
  );
}
