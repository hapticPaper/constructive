import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type BreadcrumbItem = {
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
            <div className="breadcrumbs">
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                const node = item.to ? (
                  <Link to={item.to}>{item.label}</Link>
                ) : (
                  <span>{item.label}</span>
                );

                return (
                  <Fragment key={`${item.to ?? item.label}-${index}`}>
                    {node}
                    {isLast ? null : <span>/</span>}
                  </Fragment>
                );
              })}
            </div>
          ) : null}
          <h1>{heading}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="hero-header-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
