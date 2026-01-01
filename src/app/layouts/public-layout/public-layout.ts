import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from '../../shared/navbar/navbar';
import { Footer } from '../../shared/footer/footer';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './public-layout.html',
  styleUrls: ['./public-layout.scss'],
})
export class PublicLayout {}
