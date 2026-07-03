import {
  Body,
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport redirige automáticamente a Google, este método queda vacío
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const googleUser = req.user;
    const authResponse = await this.authService.validateGoogleUser(googleUser);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(
      `${frontendUrl}/auth/callback?token=${authResponse.accessToken}`,
    );
  }
}
