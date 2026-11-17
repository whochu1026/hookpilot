import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from './auth-user';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @HttpCode(200)
  @Post('demo')
  demoLogin() {
    return this.authService.demoLogin();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }
}
