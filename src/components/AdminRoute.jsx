import { Navigate } from "react-router-dom";
import { getToken } from "../utils/auth";
import { jwtDecode}  from "jwt-decode";

export default function AdminRoute({ children }) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const decoded = jwtDecode(token);

  if (decoded.role !== "admin") {
    return <Navigate to="/home" replace />;
  }

  return children;
}
