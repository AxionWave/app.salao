import { RouterProvider } from 'react-router-dom';
import router from './router';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TermosProvider } from '@/contexts/TermosContext';

export default function App() {
    return (
        <ThemeProvider>
            <TermosProvider>
                <RouterProvider router={router} />
            </TermosProvider>
        </ThemeProvider>
    );
}
