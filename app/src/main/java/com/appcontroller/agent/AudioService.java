package com.appcontroller.agent;

import android.app.*;
import android.content.*;
import android.media.*;
import android.os.*;
import androidx.core.app.NotificationCompat;

public class AudioService extends Service {
    MediaPlayer player;
    @Override public void onCreate(){
        super.onCreate();
        createChannel();
        startForeground(21,new NotificationCompat.Builder(this,"agent")
                .setContentTitle("App Controller Agent").setContentText("Audio service").setSmallIcon(com.appcontroller.agent.R.drawable.ic_launcher_foreground).build());
    }
    @Override public int onStartCommand(Intent i,int f,int id){
        if("STOP".equals(i.getAction())) stopAudio(); else play();
        return START_NOT_STICKY;
    }
    void play(){
        stopAudio();
        player=MediaPlayer.create(this,android.provider.Settings.System.DEFAULT_NOTIFICATION_URI);
        if(player!=null){ player.setLooping(true); player.start(); }
    }
    void stopAudio(){ if(player!=null){player.stop();player.release();player=null;} }
    void createChannel(){
        if(Build.VERSION.SDK_INT>=26)((NotificationManager)getSystemService(NOTIFICATION_SERVICE))
                .createNotificationChannel(new NotificationChannel("agent","Agent",NotificationManager.IMPORTANCE_LOW));
    }
    @Override public void onDestroy(){stopAudio();super.onDestroy();}
    @Override public android.os.IBinder onBind(Intent i){return null;}
}
