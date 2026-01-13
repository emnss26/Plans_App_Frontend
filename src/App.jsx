import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { CookiesProvider } from "react-cookie";

import HomePage from './pages/General_Pages/Home.Page'
import LoginPage from './pages/General_Pages/Login.Page';
import AECProjectsPage from './pages/AEC_Model/AEC_Projects_Home';
import AECModelPlansPage from './pages/AEC_Model/AEC_Plans_Model'


import NotFoundPage from './pages/General_Pages/NotFound.Page'; 
import NotAuthorizedPage from './pages/General_Pages/NotAuthorized.Page';

import { Toaster } from  "@/components/ui/sonner"

function App() {
  return (
    <CookiesProvider>
      <Router>
        <Routes>
          <Route exact path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<NotAuthorizedPage />} />
          
          <Route path="/aec-projects" element={<AECProjectsPage />} />
          
          <Route path="/plans/:projectId" element={<AECModelPlansPage />} />

          <Route path="*" element={<NotFoundPage />} />
        
        </Routes>
        
        <Toaster position="top-right" richColors closeButton />

      </Router>
    </CookiesProvider>
  );
}

export default App
