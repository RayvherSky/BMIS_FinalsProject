import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function LegacyUserRedirect() {
  const { pathname, search, state } = useLocation();
  return <Navigate to={{ pathname: pathname.replace(/^\/resident(?=\/|$)/, '/user'), search }} state={state} replace />;
}
