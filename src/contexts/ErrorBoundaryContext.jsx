import React, { createContext, useContext } from 'react';

// Create the context
export const ErrorBoundaryContext = createContext({
    showError: () => { },
    errors: []
});

// Custom hook to use the error boundary context
export const useErrorBoundary = () => {
    const context = useContext(ErrorBoundaryContext);
    if (!context) {
        throw new Error('useErrorBoundary must be used within an ErrorBoundaryProvider');
    }
    return context;
};

// HOC for class components
export const withErrorBoundary = (_Component) => {
    return function WithErrorBoundary(props) {
        // Implementation of HOC Logic is handled in the main ErrorBoundary component
        // This is just a placeholder to resolve imports if they are used circularly
        // But typically the HOC is defined in the same file as the component or imported.
        // Since ErrorBoundary.jsx EXPORTS `withErrorBoundary`, we mostly need the Context here.

        return <_Component {...props} />;
    };
};

export const ErrorBoundaryGroup = ({ children }) => {
    return <>{children}</>;
}
