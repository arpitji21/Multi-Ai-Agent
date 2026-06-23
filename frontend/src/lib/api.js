// // import axios from 'axios';

// // const api = axios.create({
// //   baseURL: '/api',
// //   timeout: 30000,
// //   headers: { 'Content-Type': 'application/json' },
// // });

// // // Response interceptor for error handling
// // api.interceptors.response.use(
// //   (response) => response,
// //   (error) => {
// //     if (error.response?.status === 401) {
// //       // Token expired — clear storage and redirect
// //       localStorage.removeItem('mediai-auth');
// //       if (window.location.pathname !== '/login') {
// //         window.location.href = '/login';
// //       }
// //     }
// //     return Promise.reject(error);
// //   }
// // );

// // export default api;

// import axios from 'axios';

// const api = axios.create({
//   baseURL: import.meta.env.VITE_API_URL,
//   timeout: 30000,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response?.status === 401) {
//       localStorage.removeItem('mediai-auth');

//       if (window.location.pathname !== '/login') {
//         window.location.href = '/login';
//       }
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;

import axios from 'axios';

const api = axios.create({
  baseURL: 'https://multi-ai-agent-xdi9.onrender.com/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
