import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Historical from './pages/Historical';
import RecommendationDetail from './pages/RecommendationDetail';
import StockDetail from './pages/StockDetail';
import Search from './pages/Search';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/common/Layout';
import './App.css';

function App() {
  return (
    <>
      <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/historical"
          element={
            <ProtectedRoute>
              <Layout>
                <Historical />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/recommendations/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RecommendationDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stocks/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <StockDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Layout>
                <Search />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Home route - redirect to dashboard if authenticated, otherwise login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
      </BrowserRouter>
    </>
  );
}

export default App

