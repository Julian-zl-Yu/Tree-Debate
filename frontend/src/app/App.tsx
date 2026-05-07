import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { AdminReviewPage } from '../pages/AdminReviewPage';
import { CreateTopicPage } from '../pages/CreateTopicPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { TopicDetailPage } from '../pages/TopicDetailPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/topics/new" element={<CreateTopicPage />} />
        <Route path="/topics/:topicId" element={<TopicDetailPage />} />
        <Route path="/admin/reports" element={<AdminReviewPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
    </Routes>
  );
}
