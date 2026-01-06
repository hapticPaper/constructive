import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type BreadcrumbItem = {
  key: string;
  label: string;
  to?: string;
};

export function Hero({
  breadcrumbs,
  heading,
  description,
  actions,
}: {
  breadcrumbs?: BreadcrumbItem[];
  heading: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <div className="hero">
      <div className="hero-header">
        <div className="hero-header-main">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="breadcrumbs">
              <ol>
                {breadcrumbs.map((item, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  const node = item.to ? (
                    <Link to={item.to} aria-current={isLast ? 'page' : undefined}>
                      {item.label}
                    </Link>
                  ) : (
                    <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
                  );

                  return <li key={item.key}>{node}</li>;
                })}
              </ol>
            </nav>
          ) : null}
          <h1>{heading}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="hero-header-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
