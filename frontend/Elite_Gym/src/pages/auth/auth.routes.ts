import { Routes } from '@angular/router';

export const routes: Routes = [
        {path:"",children:[
        {path:'login', title:'login' , loadComponent:()=>import('./login/login').then(m=>m.Login)},
        {path:"register",title:'register',loadComponent:()=>import("./register/register").then(m=>m.Register)}
    ]},
];
