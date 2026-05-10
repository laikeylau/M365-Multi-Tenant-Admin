import React from 'react';

type SkeletonVariant = 'table' | 'card-list' | 'form' | 'profile';

interface LoadingStateProps {
  type: 'spinner' | 'skeleton';
  variant?: SkeletonVariant;
}

const Spinner: React.FC = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
  </div>
);

const TableSkeleton: React.FC = () => (
  <div className="skeleton-table">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="skeleton-row">
        <div className="skeleton-cell"></div>
        <div className="skeleton-cell"></div>
        <div className="skeleton-cell"></div>
      </div>
    ))}
  </div>
);

const CardListSkeleton: React.FC = () => (
  <div className="skeleton-card-list">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="skeleton-card">
        <div className="skeleton-title"></div>
        <div className="skeleton-text"></div>
        <div className="skeleton-text"></div>
      </div>
    ))}
  </div>
);

const FormSkeleton: React.FC = () => (
  <div className="skeleton-form">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="skeleton-field">
        <div className="skeleton-label"></div>
        <div className="skeleton-input"></div>
      </div>
    ))}
  </div>
);

export const LoadingState: React.FC<LoadingStateProps> = ({ type, variant = 'table' }) => {
  if (type === 'skeleton') {
    switch (variant) {
      case 'table':
        return <TableSkeleton />;
      case 'card-list':
        return <CardListSkeleton />;
      case 'form':
        return <FormSkeleton />;
      default:
        return <TableSkeleton />;
    }
  }
  return <Spinner />;
};
