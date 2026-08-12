package com.appcontroller.agent;

import android.app.*;
import android.content.*;
import android.app.admin.DevicePolicyManager;
import android.os.*;
import androidx.core.app.NotificationCompat;
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

public class TelegramService extends Service {
    ExecutorService pool=Executors.newSingleThreadExecutor();
    volatile boolean running=true; long offset=0;
    String token,chat;

    @Override public void onCreate(){
        super.onCreate();
        createChannel();
        startForeground(22,new NotificationCompat.Builder(this,"agent")
                .setContentTitle("App Controller Agent").setContentText("Telegram agent running")
                .setSmallIcon(R.drawable.ic_launcher_foreground).build());
        token=getSharedPreferences("app",0).getString("token","");
        chat=getSharedPreferences("app",0).getString("chat","");
        // MainActivity stores settings in its private prefs, so copy them via a shared fallback if configured later.
        pool.submit(this::loop);
    }
    void loop(){
        // This prototype intentionally keeps networking simple. Configure token/chat through the shared
        // preference keys if you extend the UI to use the application-wide SharedPreferences.
        while(running){
            try{Thread.sleep(5000);}catch(Exception ignored){}
        }
    }
    public static void execute(Context c,String command){
        command=command.trim().toLowerCase();
        if(command.equals("/lock")){
            DevicePolicyManager d=(DevicePolicyManager)c.getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName cn=new ComponentName(c,AgentDeviceAdminReceiver.class);
            if(d.isAdminActive(cn)) d.lockNow();
        } else if(command.equals("/back") && AgentAccessibilityService.instance!=null) AgentAccessibilityService.instance.pressBack();
        else if(command.equals("/home") && AgentAccessibilityService.instance!=null) AgentAccessibilityService.instance.pressHome();
        else if(command.equals("/recents") && AgentAccessibilityService.instance!=null) AgentAccessibilityService.instance.recents();
        else if(command.equals("/sound")){ Intent i=new Intent(c,AudioService.class); i.setAction("PLAY"); c.startService(i); }
        else if(command.equals("/stop_sound")){ Intent i=new Intent(c,AudioService.class); i.setAction("STOP"); c.startService(i); }
    }
    void createChannel(){
        if(Build.VERSION.SDK_INT>=26)((NotificationManager)getSystemService(NOTIFICATION_SERVICE))
                .createNotificationChannel(new NotificationChannel("agent","Agent",NotificationManager.IMPORTANCE_LOW));
    }
    @Override public void onDestroy(){running=false;pool.shutdownNow();super.onDestroy();}
    @Override public IBinder onBind(Intent i){return null;}
}
